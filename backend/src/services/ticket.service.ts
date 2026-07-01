import { AppError } from "@/core/errors/AppError";
import { prisma } from "@/database/prisma";
import { getAvailabilityByType, REDIS_KEYS, redis } from "@/database/redis";
import type { HoldCartInput } from "@/dto/ticket.dto";
import { OrderStatus, TicketStatus } from "@generated/client";
import fs from "fs";
import { fileURLToPath } from "url";

// 1. Đọc nội dung file Lua (ESM-safe: resolve relative to this module)
const holdCartScript = fs.readFileSync(
  fileURLToPath(new URL("scripts/holdCart.lua", import.meta.url)),
  "utf8",
);

// 2. Đăng ký script với ioredis. KHÔNG cố định numberOfKeys vì số loại vé thay đổi:
// gọi theo dạng holdCartAtomic(numKeys, ...keys, ...args).
redis.defineCommand("holdCartAtomic", { lua: holdCartScript });

// Thêm Type definition cho TypeScript hiểu hàm vừa định nghĩa
declare module "ioredis" {
  interface Redis {
    holdCartAtomic(
      ...args: (string | number)[]
    ): Promise<[number, string[] | number, number?]>;
  }
}

/** Giới hạn tổng số vé mua trong 1 đơn (chống gom vé). */
export const MAX_TICKETS_PER_ORDER = 10;

const HOLD_TIME_SECONDS = 300; // 5 phút

type CartItem = HoldCartInput["items"][number];

export class TicketService {
  /**
   * Danh sách các loại vé kèm giá, tổng số và số vé còn trống (real-time từ Redis).
   */
  static async getTicketTypes() {
    // Gom theo (type, price) -> tổng số vé mỗi loại. Giá đồng nhất trong 1 loại (theo seed).
    const grouped = await prisma.ticket.groupBy({
      by: ["type", "price"],
      _count: { _all: true },
      orderBy: { price: "desc" },
    });

    const availability = await getAvailabilityByType();

    return grouped.map((row) => ({
      type: row.type,
      price: row.price, // Prisma Decimal -> serialize thành string trong JSON
      total: row._count._all,
      available: availability[row.type] ?? 0,
    }));
  }

  /**
   * Giữ NHIỀU vé thuộc NHIỀU loại cùng lúc (giỏ vé), ATOMIC & ALL-OR-NOTHING.
   * Danh tính user xác minh qua email (upsert theo email).
   *
   * Chống over-selling: toàn bộ thao tác trừ kho chạy trong 1 Lua script atomic
   * trên Redis; nếu bất kỳ loại nào không đủ -> rollback sạch, không giữ vé nào.
   */
  static async holdCart(input: HoldCartInput) {
    const items = mergeCartItems(input.items);

    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    if (totalQty === 0) {
      throw new AppError("Giỏ vé trống, vui lòng chọn ít nhất 1 vé.", 400);
    }
    if (totalQty > MAX_TICKETS_PER_ORDER) {
      throw new AppError(
        `Mỗi đơn chỉ được mua tối đa ${MAX_TICKETS_PER_ORDER} vé.`,
        400,
      );
    }

    // BƯỚC 1: Xác minh danh tính qua email -> upsert User, lấy userId ổn định.
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: input.name ? { name: input.name } : {},
      create: {
        email: input.email,
        name: input.name?.trim() || input.email.split("@")[0] || "Khách",
      },
    });

    // BƯỚC 2: Atomic multi-pop trên Redis (all-or-nothing).
    const keys = items.map((it) => REDIS_KEYS.availableByType(it.type));
    const quantities = items.map((it) => String(it.quantity));

    const [status, payload, availableNow] = await redis.holdCartAtomic(
      keys.length,
      ...keys,
      user.id,
      String(HOLD_TIME_SECONDS),
      REDIS_KEYS.HOLD_PREFIX,
      ...quantities,
    );

    if (status === 0) {
      const shortItem = items[(payload as number) - 1];
      throw new AppError(
        `Loại vé "${shortItem?.type}" chỉ còn ${availableNow ?? 0} vé, ` +
          `không đủ ${shortItem?.quantity} vé bạn chọn. Không có vé nào bị giữ.`,
        409,
      );
    }

    const ticketIds = payload as string[];

    // BƯỚC 3: Ghi DB (tạo Order + gán toàn bộ vé) trong 1 transaction.
    try {
      const expiresAt = new Date(Date.now() + HOLD_TIME_SECONDS * 1000);

      const result = await prisma.$transaction(async (tx) => {
        const tickets = await tx.ticket.findMany({
          where: { id: { in: ticketIds } },
        });
        if (tickets.length !== ticketIds.length) {
          throw new Error("Danh sách vé không đồng bộ giữa Redis và DB.");
        }

        const totalAmount = tickets.reduce(
          (sum, t) => sum + Number(t.price),
          0,
        );

        const order = await tx.order.create({
          data: {
            userId: user.id,
            totalAmount,
            status: OrderStatus.PENDING,
            expiresAt,
          },
        });

        await tx.ticket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status: TicketStatus.HOLD, orderId: order.id },
        });

        const heldTickets = await tx.ticket.findMany({
          where: { orderId: order.id },
          orderBy: { price: "desc" },
        });

        return { order, tickets: heldTickets };
      });

      return {
        success: true,
        message: `Đã giữ ${ticketIds.length} vé! Bạn có 5 phút để thanh toán.`,
        data: result,
      };
    } catch (dbError) {
      // EDGE CASE: DB lỗi sau khi Redis đã trừ kho -> PHẢI hoàn trả vé về Redis,
      // nếu không vé sẽ "mất tích". Map id -> loại dựa trên thứ tự pop (theo quantities).
      console.error("Lỗi DB khi tạo đơn giữ vé, đang Rollback Redis...", dbError);

      const pipeline = redis.pipeline();
      let cursor = 0;
      for (const it of items) {
        const idsForType = ticketIds.slice(cursor, cursor + it.quantity);
        cursor += it.quantity;
        if (idsForType.length > 0) {
          pipeline.sadd(REDIS_KEYS.availableByType(it.type), ...idsForType);
        }
        for (const id of idsForType) {
          pipeline.del(`${REDIS_KEYS.HOLD_PREFIX}${id}`);
        }
      }
      await pipeline.exec();

      throw new AppError(
        "Có lỗi xảy ra khi tạo đơn hàng, đã hoàn tác giữ vé.",
        500,
      );
    }
  }
}

/** Gộp các dòng trùng loại trong giỏ và loại bỏ dòng quantity <= 0. */
function mergeCartItems(items: CartItem[]): CartItem[] {
  const merged = new Map<string, number>();
  for (const it of items) {
    if (it.quantity <= 0) continue;
    merged.set(it.type, (merged.get(it.type) ?? 0) + it.quantity);
  }
  return [...merged.entries()].map(([type, quantity]) => ({ type, quantity }));
}
