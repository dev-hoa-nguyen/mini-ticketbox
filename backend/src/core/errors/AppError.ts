/**
 * Lỗi nghiệp vụ có kèm HTTP status code.
 * Global Error Handler đọc `statusCode` để trả đúng mã (400/409/503...).
 */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, AppError);
  }
}
