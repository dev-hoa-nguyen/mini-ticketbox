import { prisma } from "@/database/prisma";
import { OrderStatus, TicketStatus } from "@generated/client";

export class AdminService {
  static async getDashboardStats() {
    // Chạy song song các query để tối ưu thời gian phản hồi
    const [available, hold, sold, revenueData] = await Promise.all([
      prisma.ticket.count({ where: { status: TicketStatus.AVAILABLE } }),
      prisma.ticket.count({ where: { status: TicketStatus.HOLD } }),
      prisma.ticket.count({ where: { status: TicketStatus.SOLD } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: OrderStatus.COMPLETED },
      }),
    ]);

    return {
      tickets: {
        total: 500,
        available,
        hold,
        sold,
      },
      revenue: revenueData._sum.totalAmount || 0,
    };
  }
}
