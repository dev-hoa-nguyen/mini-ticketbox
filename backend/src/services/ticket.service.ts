import { prisma } from "@/database/prisma";
import { REDIS_KEYS, redis } from "@/database/redis";
import { OrderStatus, TicketStatus } from "@generated/client";
import fs from "fs";
import { fileURLToPath } from "url";

// 1. Đọc nội dung file Lua (ESM-safe: resolve relative to this module)
const holdTicketScript = fs.readFileSync(
  fileURLToPath(new URL("scripts/holdTicket.lua", import.meta.url)),
  "utf8",
);

// 2. Đăng ký script với ioredis (Tên hàm: holdTicketAtomic)
redis.defineCommand("holdTicketAtomic", {
  numberOfKeys: 1, // Số lượng tham số KEYS[...] trong script là 1
  lua: holdTicketScript,
});

// Thêm Type definition cho TypeScript hiểu hàm vừa định nghĩa
declare module "ioredis" {
  interface Redis {
    holdTicketAtomic(
      key: string,
      userId: string,
      ttl: string,
      holdPrefix: string,
    ): Promise<[number, string]>;
  }
}

export class TicketService {
  /**
   * Xử lý giữ vé cho User (Chịu tải cao, chống Over-selling)
   */
  static async holdTicket(userId: string) {
    const HOLD_TIME_SECONDS = "300"; // 5 phút = 300 giây

    // BƯỚC 1: Thực thi Lua Script trên Redis (RAM) - Cực nhanh & Atomic
    const [status, result] = await redis.holdTicketAtomic(
      REDIS_KEYS.AVAILABLE_TICKETS,
      userId,
      HOLD_TIME_SECONDS,
      REDIS_KEYS.HOLD_PREFIX,
    );

    // Nếu status == 0, tức là hết vé
    if (status === 0) {
      throw new Error("Hết vé hoặc hệ thống đang bận, vui lòng thử lại!");
    }

    const reservedTicketId = result; // Đây là ID vé lấy được từ Redis

    // BƯỚC 2: Đồng bộ xuống PostgreSQL (Tạo Order & Update Ticket)
    // Sau khi RAM đã khóa thành công, ta mới ghi xuống Disk bằng Transaction
    try {
      const expiresAt = new Date(Date.now() + 300 * 1000); // 5 phút sau

      const dbResult = await prisma.$transaction(async (tx) => {
        // Lấy thông tin giá vé
        const ticket = await tx.ticket.findUnique({
          where: { id: reservedTicketId },
        });

        if (!ticket) throw new Error("Vé không tồn tại trong DB!");

        // ==========================================
        // 🌟 BỔ SUNG FIX LỖI FOREIGN KEY
        // Đảm bảo User tồn tại trước khi tạo Order
        // ==========================================
        await tx.user.upsert({
          where: { id: userId },
          update: {}, // Nếu user đã tồn tại thì bỏ qua
          create: {
            id: userId,
            email: `guest-${userId}@ticketbox.mini`,
            name: `Guest ${userId.substring(0, 6)}`,
          },
        });

        // Tạo đơn hàng giữ chỗ (Order PENDING)
        const order = await tx.order.create({
          data: {
            userId,
            totalAmount: ticket.price,
            status: OrderStatus.PENDING,
            expiresAt,
          },
        });

        // Cập nhật trạng thái vé sang HOLD và gán vào Order
        const updatedTicket = await tx.ticket.update({
          where: { id: reservedTicketId },
          data: {
            status: TicketStatus.HOLD,
            orderId: order.id,
          },
        });

        return { order, ticket: updatedTicket };
      });

      return {
        success: true,
        message: "Giữ vé thành công! Bạn có 5 phút để thanh toán.",
        data: dbResult,
      };
    } catch (dbError) {
      // ⚠️ EDGE CASE TỐI QUAN TRỌNG:
      // Nếu ghi xuống DB thất bại (lỗi mạng DB, crash... ), ta PHẢI hoàn trả vé lại cho Redis
      // nếu không vé này sẽ bị "mất tích" khỏi hệ thống!
      console.error(
        "Lỗi DB khi tạo đơn giữ vé, đang Rollback Redis...",
        dbError,
      );

      await redis.del(`${REDIS_KEYS.HOLD_PREFIX}${reservedTicketId}`);
      await redis.sadd(REDIS_KEYS.AVAILABLE_TICKETS, reservedTicketId);

      throw new Error("Có lỗi xảy ra khi tạo đơn hàng, đã hoàn tác giữ vé.");
    }
  }
}
