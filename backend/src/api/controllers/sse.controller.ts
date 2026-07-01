import { getAvailabilityByType } from "@/database/redis";
import type { Request, Response } from "express";

// Lưu trữ danh sách các kết nối của Client
const clients = new Set<Response>();

/** Gói payload real-time: tổng vé trống + số vé trống theo từng loại. */
async function buildSnapshot(): Promise<string> {
  const byType = await getAvailabilityByType();
  const availableCount = Object.values(byType).reduce((sum, n) => sum + n, 0);
  return `data: ${JSON.stringify({ availableCount, byType })}\n\n`;
}

// Vòng lặp ngầm: Lấy số lượng vé từ Redis và bắn cho tất cả Clients mỗi 2 giây
setInterval(async () => {
  if (clients.size === 0) return;

  try {
    const message = await buildSnapshot();
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

    // Bắn ngay snapshot lần đầu khi vừa kết nối
    buildSnapshot()
      .then((message) => res.write(message))
      .catch((error) => console.error("Lỗi khi gửi snapshot SSE:", error));

    // 3. Xử lý khi Client ngắt kết nối (tắt tab, rớt mạng)
    req.on("close", () => {
      clients.delete(res);
      res.end();
    });
  };
}
