import { app } from "./app";
import { prisma } from "./database/prisma";
import {
  redis,
  redisSubscriber,
  setupRedisKeyspaceNotifications,
  syncTicketsToRedis,
} from "./database/redis";
import { ReleaseTicketWorker } from "./services/workers/releaseTicket.worker";

const PORT = process.env.PORT || 8080;

async function bootstrap() {
  try {
    // 1. Kiểm tra kết nối Database
    await prisma.$connect();
    console.log("🟢 Đã kết nối PostgreSQL thành công!");

    // (Tùy chọn) Redis tự động kết nối qua file config,
    // nhưng ta có thể ping thử để chắc chắn nó đang sống
    await redis.ping();
    await redisSubscriber.ping();

    await setupRedisKeyspaceNotifications();
    await syncTicketsToRedis(); // Nạp 500 vé trống lên RAM

    // 3. Start Release Ticket Worker
    ReleaseTicketWorker.start();

    // 2. Start Express Server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });

    // 3. Xử lý Graceful Shutdown (Tắt server an toàn)
    const gracefulShutdown = async () => {
      console.log("\nĐang đóng các kết nối để tắt server an toàn...");
      server.close();
      await prisma.$disconnect();
      await redis.quit();
      console.log("Đã tắt server hoàn toàn.");
      process.exit(0);
    };

    process.on("SIGINT", gracefulShutdown); // Bắt sự kiện Ctrl+C
    process.on("SIGTERM", gracefulShutdown); // Bắt sự kiện kill process từ Docker/Hệ điều hành
  } catch (error) {
    console.error("🔴 Lỗi khi khởi động server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
