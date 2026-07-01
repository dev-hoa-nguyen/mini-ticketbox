import { TicketStatus } from "@generated/client";
import Redis from "ioredis";
import { prisma } from "./prisma";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Khởi tạo Redis Client
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3, // Tránh treo hệ thống nếu Redis sập
  retryStrategy(times) {
    // Thử kết nối lại, tăng dần thời gian delay (tối đa 2 giây)
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Lắng nghe các sự kiện để dễ debug
redis.on("connect", () => {
  console.log("🟢 Đã kết nối tới Redis thành công!");
});

redis.on("error", (err) => {
  console.error("🔴 Lỗi kết nối Redis:", err);
});

export const REDIS_KEYS = {
  AVAILABLE_TICKETS: "tickets:available",
  HOLD_PREFIX: "ticket:hold:",
};

export async function syncTicketsToRedis() {
  console.log("🔄 Đang đồng bộ danh sách vé trống từ DB lên Redis...");

  // 1. Lấy tất cả ID vé có trạng thái AVAILABLE từ DB
  const availableTickets = await prisma.ticket.findMany({
    where: { status: TicketStatus.AVAILABLE },
    select: { id: true },
  });

  if (availableTickets.length === 0) {
    console.log("⚠️ Không tìm thấy vé trống nào trong Database để đồng bộ.");
    return;
  }

  // 2. Xóa set cũ trên Redis để tránh dữ liệu rác
  await redis.del(REDIS_KEYS.AVAILABLE_TICKETS);

  // 3. Đẩy toàn bộ ID vé vào Redis Set
  const ticketIds = availableTickets.map((t) => t.id);

  // Dùng lệnh SADD của Redis (thêm mảng ID vào Set)
  await redis.sadd(REDIS_KEYS.AVAILABLE_TICKETS, ...ticketIds);

  console.log(`✅ Đồng bộ thành công ${ticketIds.length} vé lên Redis!`);
}

// Client phụ chỉ dùng để lắng nghe sự kiện (Subscriber)
export const redisSubscriber = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
});

// Hàm khởi tạo cấu hình Keyspace Notification
export async function setupRedisKeyspaceNotifications() {
  try {
    // Bật thông báo cho các sự kiện Expired (Ex)
    await redis.config("SET", "notify-keyspace-events", "Ex");
    console.log(
      "🟢 Đã bật tính năng Redis Keyspace Notifications (Expired Events)",
    );
  } catch (error) {
    console.error("🔴 Lỗi khi cấu hình Redis Keyspace:", error);
  }
}
