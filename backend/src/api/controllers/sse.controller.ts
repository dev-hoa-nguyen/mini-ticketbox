import { redis, REDIS_KEYS } from "@/database/redis";
import type { Request, Response } from "express";

// Lưu trữ danh sách các kết nối của Client
const clients = new Set<Response>();

// Vòng lặp ngầm: Lấy số lượng vé từ Redis và bắn cho tất cả Clients mỗi 2 giây
setInterval(async () => {
  if (clients.size === 0) return;

  try {
    // SCARD: Đếm số lượng phần tử trong Set cực kỳ nhanh (O(1))
    const availableCount = await redis.scard(REDIS_KEYS.AVAILABLE_TICKETS);
    const message = `data: ${JSON.stringify({ availableCount })}\n\n`;

    clients.forEach((client) => client.write(message));
  } catch (error) {
    console.error("Lỗi khi broadcast SSE:", error);
  }
}, 2000);

export class SSEController {
  static streamTickets = (req: Request, res: Response) => {
    // 1. Thiết lập Header cho SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // 2. Thêm client vào danh sách phát sóng
    clients.add(res);

    // Bắn ngay data lần đầu khi vừa kết nối
    redis.scard(REDIS_KEYS.AVAILABLE_TICKETS).then((count) => {
      res.write(`data: ${JSON.stringify({ availableCount: count })}\n\n`);
    });

    // 3. Xử lý khi Client ngắt kết nối (tắt tab, rớt mạng)
    req.on("close", () => {
      clients.delete(res);
      res.end();
    });
  };
}
