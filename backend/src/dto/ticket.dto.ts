import { z } from "zod";

export const holdTicketSchema = z.object({
  body: z.object({
    // Zod v4: top-level z.uuid() thay cho .uuid() method (đã deprecated)
    userId: z.uuid({ error: "userId phải là định dạng UUID hợp lệ và bắt buộc" }),
  }),
});

// Type suy luận từ Zod Schema để dùng trong TypeScript
export type HoldTicketInput = z.infer<typeof holdTicketSchema>["body"];
