import { catchAsync } from "@/core/utils/catchAsync";
import { holdCartSchema } from "@/dto/ticket.dto";
import { TicketService } from "@/services/ticket.service";
import type { Request, Response } from "express";

export class TicketController {
  /**
   * POST /api/tickets/hold
   * Giữ giỏ vé (nhiều loại/nhiều số lượng) sau khi xác minh email.
   */
  static holdTicket = catchAsync(async (req: Request, res: Response) => {
    // 1. Validate dữ liệu đầu vào với Zod
    const { body } = holdCartSchema.parse({ body: req.body });

    // 2. Gọi Business Logic từ Service (giữ toàn bộ giỏ, all-or-nothing)
    const result = await TicketService.holdCart(body);

    // 3. Trả về đúng format quy định
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
      error: null,
    });
  });

  /**
   * GET /api/tickets/types
   * Danh sách loại vé kèm giá, tổng số & số vé còn trống (real-time).
   */
  static getTypes = catchAsync(async (_req: Request, res: Response) => {
    const data = await TicketService.getTicketTypes();

    res.status(200).json({
      success: true,
      message: "Lấy danh sách loại vé thành công",
      data,
      error: null,
    });
  });
}
