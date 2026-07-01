import { prisma } from "@/database/prisma";
import { OrderStatus, TicketStatus } from "@generated/client";

interface TypeStat {
  type: string;
  price: number;
  total: number;
  available: number;
  hold: number;
  sold: number;
  revenue: number;
}

export class AdminService {
  static async getDashboardStats() {
    // 1 query gom vé theo (loại, trạng thái, giá) + 1 query tổng doanh thu đơn đã thanh toán.
    const [grouped, revenueData] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["type", "status", "price"],
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: OrderStatus.COMPLETED },
      }),
    ]);

    // Bóc tách theo từng loại vé.
    const byTypeMap = new Map<string, TypeStat>();
    for (const row of grouped) {
      const entry = byTypeMap.get(row.type) ?? {
        type: row.type,
        price: Number(row.price),
        total: 0,
        available: 0,
        hold: 0,
        sold: 0,
        revenue: 0,
      };
      const count = row._count._all;
      entry.price = Number(row.price); // giá đồng nhất trong 1 loại
      entry.total += count;

      if (row.status === TicketStatus.AVAILABLE) entry.available += count;
      else if (row.status === TicketStatus.HOLD) entry.hold += count;
      else if (row.status === TicketStatus.SOLD) {
        entry.sold += count;
        entry.revenue += count * Number(row.price);
      }

      byTypeMap.set(row.type, entry);
    }

    const byType = [...byTypeMap.values()].sort((a, b) => b.price - a.price);

    // Tổng hợp toàn hệ thống suy ra từ byType (tránh query trùng lặp).
    const tickets = byType.reduce(
      (acc, t) => ({
        total: acc.total + t.total,
        available: acc.available + t.available,
        hold: acc.hold + t.hold,
        sold: acc.sold + t.sold,
      }),
      { total: 0, available: 0, hold: 0, sold: 0 },
    );

    return {
      tickets,
      revenue: revenueData._sum.totalAmount || 0,
      byType,
    };
  }
}
