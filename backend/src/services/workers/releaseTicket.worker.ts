import { prisma } from "@/database/prisma";
import { redis, REDIS_KEYS, redisSubscriber } from "@/database/redis";
import { OrderStatus, TicketStatus } from "@generated/client";

export class ReleaseTicketWorker {
  static start() {
    // Đăng ký lắng nghe kênh sự kiện key hết hạn của Redis
    // Cú pháp mặc định của Redis Pub/Sub cho db 0 là: __keyevent@0__:expired
    const expiredChannel = "__keyevent@0__:expired";

    redisSubscriber.subscribe(expiredChannel, (err, count) => {
      if (err) {
        console.error("🔴 Lỗi khi subscribe kênh expired:", err);
        return;
      }
      console.log(`🎧 Worker đang lắng nghe sự kiện nhả vé tự động...`);
    });

    // Xử lý khi có message (sự kiện key hết hạn) bay về
    redisSubscriber.on("message", async (channel, expiredKey) => {
      // Chỉ quan tâm đến các key có tiền tố là ticket:hold:
      if (
        channel === expiredChannel &&
        expiredKey.startsWith(REDIS_KEYS.HOLD_PREFIX)
      ) {
        // Tách ID vé từ key (VD: ticket:hold:12345 -> 12345)
        const ticketId = expiredKey.replace(REDIS_KEYS.HOLD_PREFIX, "");
        console.log(
          `⚠️ [TIMEOUT] Vé ${ticketId} đã hết 5 phút giữ chỗ. Đang tiến hành nhả vé...`,
        );

        await this.handleReleaseTicket(ticketId);
      }
    });
  }

  private static async handleReleaseTicket(ticketId: string) {
    try {
      // 1. Dùng Transaction để cập nhật DB một cách an toàn
      const dbResult = await prisma.$transaction(async (tx) => {
        // Tìm vé đang bị giữ
        const ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
        });

        if (!ticket || ticket.status !== TicketStatus.HOLD || !ticket.orderId) {
          // Vé có thể đã được thanh toán thành công (status = SOLD), bỏ qua
          return null;
        }

        // Kiểm tra đơn hàng hiện tại
        const order = await tx.order.findUnique({
          where: { id: ticket.orderId },
        });

        if (!order || order.status !== OrderStatus.PENDING) {
          return null;
        }

        // Cập nhật DB: Hủy đơn hàng và nhả vé
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });

        const releasedTicket = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: TicketStatus.AVAILABLE,
            orderId: null, // Cắt đứt quan hệ với đơn hàng cũ
          },
        });

        return releasedTicket;
      });

      // 2. Nếu DB xử lý thành công, đẩy vé trở lại Set "tickets:available" trên Redis
      if (dbResult) {
        await redis.sadd(REDIS_KEYS.AVAILABLE_TICKETS, ticketId);
        console.log(
          `✅ [RELEASED] Đã trả vé ${ticketId} về lại kho trống thành công.`,
        );

        // TODO: (Sau này) Bắn sự kiện SSE để Frontend cập nhật số lượng vé tăng lên
      }
    } catch (error) {
      console.error(`🔴 Lỗi khi nhả vé ${ticketId}:`, error);
      // Ghi log để có thể xử lý bù (compensate) sau này
    }
  }
}
