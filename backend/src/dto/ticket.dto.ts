import { z } from "zod";

export const holdCartSchema = z.object({
  body: z.object({
    // Danh tính user xác minh bằng email (Zod v4: top-level z.email()).
    email: z.email({ error: "Email không hợp lệ, vui lòng nhập đúng email." }),
    name: z.string().trim().min(1).max(120).optional(),
    // Giỏ vé: nhiều loại, mỗi loại có số lượng.
    items: z
      .array(
        z.object({
          type: z
            .string({ error: "type (loại vé) là bắt buộc" })
            .trim()
            .min(1, { error: "Loại vé không hợp lệ" }),
          quantity: z
            .int({ error: "Số lượng phải là số nguyên" })
            .min(1, { error: "Số lượng tối thiểu là 1" })
            .max(10, { error: "Số lượng mỗi loại tối đa là 10" }),
        }),
      )
      .min(1, { error: "Giỏ vé phải có ít nhất 1 loại vé" }),
  }),
});

// Type suy luận từ Zod Schema để dùng trong TypeScript
export type HoldCartInput = z.infer<typeof holdCartSchema>["body"];
