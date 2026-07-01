import { catchAsync } from "@/core/utils/catchAsync";
import { holdTicketSchema } from "@/dto/ticket.dto";
import { TicketService } from "@/services/ticket.service";
import type { Request, Response } from "express";

export class TicketController {
  /**
   * POST /api/tickets/hold
   * API Đặt / Giữ vé
   */
  static holdTicket = catchAsync(async (req: Request, res: Response) => {
    // 1. Validate dữ liệu đầu vào với Zod
    const validatedData = holdTicketSchema.parse({
      body: req.body,
    });

    const { userId } = validatedData.body;

    // 2. Gọi Business Logic từ Service
    const result = await TicketService.holdTicket(userId);

    // 3. Trả về đúng format quy định
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
      error: null,
    });
  });
}
