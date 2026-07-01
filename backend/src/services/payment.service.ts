import { AppError } from "@/core/errors/AppError";
import { prisma } from "@/database/prisma";
import { redis, REDIS_KEYS } from "@/database/redis";
import { OrderStatus, TicketStatus } from "@generated/client";

export class PaymentService {
  static async processPayment(orderId: string) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng + toàn bộ vé trong giỏ
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { tickets: true },
      });

      if (!order) throw new AppError("Đơn hàng không tồn tại", 404);
      if (order.status === OrderStatus.COMPLETED)
        throw new AppError("Đơn hàng đã được thanh toán", 409);
      if (order.status === OrderStatus.EXPIRED)
        throw new AppError("Đơn hàng đã hết hạn thanh toán", 410);
      if (order.tickets.length === 0)
        throw new AppError("Không tìm thấy vé liên kết với đơn hàng", 409);

      // 2. Cập nhật trạng thái: Order COMPLETED, toàn bộ vé SOLD
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      await tx.ticket.updateMany({
        where: { orderId },
        data: { status: TicketStatus.SOLD },
      });

      const soldTickets = await tx.ticket.findMany({
        where: { orderId },
        orderBy: { price: "desc" },
      });

      return { order: updatedOrder, tickets: soldTickets };
    });

    // 3. Xoá toàn bộ hold key trên Redis -> chặn Keyspace expired bắn nhả vé nhầm
    const pipeline = redis.pipeline();
    for (const ticket of result.tickets) {
      pipeline.del(`${REDIS_KEYS.HOLD_PREFIX}${ticket.id}`);
    }
    await pipeline.exec();

    return result;
  }
}
