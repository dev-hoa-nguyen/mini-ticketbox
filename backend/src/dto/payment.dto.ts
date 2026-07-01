import { z } from "zod";

export const paymentSchema = z.object({
  body: z.object({
    orderId: z.uuid({
      error: "orderId phải là định dạng UUID hợp lệ và bắt buộc",
    }),
  }),
});
