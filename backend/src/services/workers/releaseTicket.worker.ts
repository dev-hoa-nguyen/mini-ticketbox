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
      // 1. Transaction: hết hạn CẢ đơn (giỏ vé) và nhả TOÀN BỘ vé của đơn đó.
      // Vé trong 1 giỏ có cùng TTL nên hết hạn gần như đồng thời; ta xử lý trọn
      // đơn ngay ở sự kiện đầu tiên -> tránh trạng thái nửa vời.
      const releasedTickets = await prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });

        if (!ticket || ticket.status !== TicketStatus.HOLD || !ticket.orderId) {
          // Vé đã SOLD (thanh toán xong) hoặc đã được xử lý -> bỏ qua.
          return null;
        }

        const order = await tx.order.findUnique({
          where: { id: ticket.orderId },
        });
        if (!order || order.status !== OrderStatus.PENDING) {
          return null;
        }

        // Lấy toàn bộ vé của đơn TRƯỚC khi cắt quan hệ (để biết loại mà trả về kho)
        const siblings = await tx.ticket.findMany({
          where: { orderId: order.id },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });

        await tx.ticket.updateMany({
          where: { orderId: order.id },
          data: { status: TicketStatus.AVAILABLE, orderId: null },
        });

        return siblings;
      });

      // 2. Trả toàn bộ vé về đúng Set theo loại + dọn các hold key anh em còn lại.
      if (releasedTickets && releasedTickets.length > 0) {
        const pipeline = redis.pipeline();
        for (const ticket of releasedTickets) {
          pipeline.sadd(REDIS_KEYS.availableByType(ticket.type), ticket.id);
          pipeline.sadd(REDIS_KEYS.TYPES_SET, ticket.type);
          // Xoá hold key anh em để sự kiện expired của chúng không lặp lại vô ích.
          pipeline.del(`${REDIS_KEYS.HOLD_PREFIX}${ticket.id}`);
        }
        await pipeline.exec();

        console.log(
          `✅ [RELEASED] Đã nhả ${releasedTickets.length} vé của đơn hết hạn về lại kho.`,
        );
      }
    } catch (error) {
      console.error(`🔴 Lỗi khi nhả vé ${ticketId}:`, error);
      // Ghi log để có thể xử lý bù (compensate) sau này
    }
  }
}
