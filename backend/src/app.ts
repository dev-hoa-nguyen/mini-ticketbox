import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { ZodError } from "zod";
import { appRoutes } from "./api/routers";

const app = express();
// Middlewares
app.use(cors()); // Cần thiết để Frontend (chạy port khác) có thể gọi API và SSE
app.use(express.json());

// Gắn toàn bộ Routes
app.use("/api", appRoutes);

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ success: true, message: "Server is running healthy!" });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔴 [Global Error]:", err);

  // Xử lý lỗi Validate từ Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "VALIDATION_ERROR",
      message: err.issues.map((e) => e.message).join(", "),
    });
  }

  // Xử lý các lỗi Logic (ví dụ: Hết vé)
  const statusCode = err.statusCode || 500;
  const message = err.message || "Lỗi hệ thống nội bộ";

  res.status(statusCode).json({
    success: false,
    data: null,
    error: err.name || "SERVER_ERROR",
    message: message,
  });
});

export { app };
