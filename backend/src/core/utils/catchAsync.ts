import type { NextFunction, Request, Response } from "express";

// Hàm bọc các Async Controller để tự động bắt lỗi và truyền cho NextFunction
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};
