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
  HOLD_PREFIX: "ticket:hold:",
  // Registry chứa tên tất cả loại vé (để SSE/aggregate duyệt qua từng loại).
  TYPES_SET: "tickets:types",
  // Mỗi loại vé có 1 Set vé trống riêng -> giữ vé Atomic theo đúng loại,
  // chống over-selling ở cấp độ từng loại vé.
  availableByType: (type: string) => `tickets:available:${type}`,
};

/**
 * Đếm số vé trống theo từng loại từ Redis (RAM = nguồn chân lý real-time).
 * Dùng pipeline để gộp N lệnh SCARD trong 1 round-trip.
 */
export async function getAvailabilityByType(): Promise<Record<string, number>> {
  const types = await redis.smembers(REDIS_KEYS.TYPES_SET);
  if (types.length === 0) return {};

  const pipeline = redis.pipeline();
  types.forEach((type) => pipeline.scard(REDIS_KEYS.availableByType(type)));
  const results = await pipeline.exec();

  const availability: Record<string, number> = {};
  types.forEach((type, idx) => {
    const count = results?.[idx]?.[1];
    availability[type] = typeof count === "number" ? count : 0;
  });
  return availability;
}

export async function syncTicketsToRedis() {
  console.log("🔄 Đang đồng bộ danh sách vé trống (theo loại) từ DB lên Redis...");

  // 1. Lấy tất cả vé AVAILABLE kèm loại vé
  const availableTickets = await prisma.ticket.findMany({
    where: { status: TicketStatus.AVAILABLE },
    select: { id: true, type: true },
  });

  // 2. Dọn set cũ (mọi loại đã đăng ký trước đó) để tránh dữ liệu rác
  const oldTypes = await redis.smembers(REDIS_KEYS.TYPES_SET);
  const cleanup = redis.pipeline();
  oldTypes.forEach((type) => cleanup.del(REDIS_KEYS.availableByType(type)));
  cleanup.del(REDIS_KEYS.TYPES_SET);
  await cleanup.exec();

  if (availableTickets.length === 0) {
    console.log("⚠️ Không tìm thấy vé trống nào trong Database để đồng bộ.");
    return;
  }

  // 3. Gom vé theo loại rồi đẩy vào từng Set tương ứng
  const byType = new Map<string, string[]>();
  for (const ticket of availableTickets) {
    const bucket = byType.get(ticket.type) ?? [];
    bucket.push(ticket.id);
    byType.set(ticket.type, bucket);
  }

  const pipeline = redis.pipeline();
  for (const [type, ids] of byType) {
    pipeline.sadd(REDIS_KEYS.availableByType(type), ...ids);
    pipeline.sadd(REDIS_KEYS.TYPES_SET, type);
  }
  await pipeline.exec();

  console.log(
    `✅ Đồng bộ thành công ${availableTickets.length} vé thuộc ${byType.size} loại lên Redis!`,
  );
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
