import { catchAsync } from "@/core/utils/catchAsync";
import { AdminService } from "@/services/admin.service";
import type { Request, Response } from "express";

export class AdminController {
  static getStats = catchAsync(async (req: Request, res: Response) => {
    const stats = await AdminService.getDashboardStats();

    res.status(200).json({
      success: true,
      message: "Lấy thống kê thành công",
      data: stats,
      error: null,
    });
  });
}
