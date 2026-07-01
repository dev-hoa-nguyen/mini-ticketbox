import { catchAsync } from "@/core/utils/catchAsync";
import { paymentSchema } from "@/dto/payment.dto";
import { PaymentService } from "@/services/payment.service";
import type { Request, Response } from "express";

export class PaymentController {
  static pay = catchAsync(async (req: Request, res: Response) => {
    const { orderId } = paymentSchema.parse({ body: req.body }).body;

    const result = await PaymentService.processPayment(orderId);

    res.status(200).json({
      success: true,
      message: "Thanh toán thành công!",
      data: result,
      error: null,
    });
  });
}
