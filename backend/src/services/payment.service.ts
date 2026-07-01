import { prisma } from "@/database/prisma";
import { redis, REDIS_KEYS } from "@/database/redis";
import { OrderStatus, TicketStatus } from "@generated/client";

export class PaymentService {
  static async processPayment(orderId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { ticket: true },
      });

      if (!order) throw new Error("Đơn hàng không tồn tại");
      if (order.status === OrderStatus.COMPLETED)
        throw new Error("Đơn hàng đã được thanh toán");
      if (order.status === OrderStatus.EXPIRED)
        throw new Error("Đơn hàng đã hết hạn thanh toán");
      if (!order.ticket)
        throw new Error("Không tìm thấy vé liên kết với đơn hàng");

      // 2. Cập nhật trạng thái
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      const updatedTicket = await tx.ticket.update({
        where: { id: order.ticket.id },
        data: { status: TicketStatus.SOLD },
      });

      // 3. XÓA KEY GIỮ VÉ TRÊN REDIS
      // Điều này ngăn chặn Keyspace Notification phát ra sự kiện Expired
      await redis.del(`${REDIS_KEYS.HOLD_PREFIX}${order.ticket.id}`);

      return {
        order: updatedOrder,
        ticket: updatedTicket,
      };
    });
  }
}
