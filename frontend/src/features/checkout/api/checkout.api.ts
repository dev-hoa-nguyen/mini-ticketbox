import { apiRequest } from "@/lib/api-client"
import type { HoldCartPayload, HoldResult, PaymentResult } from "@/types/api"

/**
 * Fetcher functions cho TanStack Query.
 * `apiRequest` đã parse response chuẩn `{ success, data, message, error }`
 * và ném `ApiError` (kèm `status` + `message`) khi thất bại — UI chỉ cần bắt lỗi.
 */

/** POST /tickets/hold — giữ cả giỏ vé (nhiều loại) trong 5 phút, xác minh qua email. */
export function holdCart(payload: HoldCartPayload): Promise<HoldResult> {
  return apiRequest<HoldResult>("/tickets/hold", {
    method: "POST",
    body: payload,
  })
}

/** POST /tickets/pay — thanh toán giả lập cho order đang giữ. */
export function payOrder(orderId: string): Promise<PaymentResult> {
  return apiRequest<PaymentResult>("/tickets/pay", {
    method: "POST",
    body: { orderId },
  })
}
