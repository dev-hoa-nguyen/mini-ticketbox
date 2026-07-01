import { API_URL } from "./env"
import type { ApiResponse } from "@/types/api"

const TOKEN_KEY = "ticketbox:token"

/**
 * Lỗi chuẩn hoá từ tầng API. Giữ lại `status` để UI phân biệt
 * các trường hợp chịu tải cao (429 Too Many Requests, 503 Service Unavailable).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }

  /** Server quá tải / rate-limit -> UI nên khuyên user thử lại. */
  get isOverloaded(): boolean {
    return this.status === 429 || this.status === 503
  }
}

interface RequestOptions {
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
}

/** Lấy token từ localStorage (SSR-safe). */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

/**
 * Wrapper fetch duy nhất cho toàn app.
 * - Tự gắn Authorization header nếu có token.
 * - Tự parse response chuẩn hoá `{ success, data, error, message }`.
 * - Ném `ApiError` khi `success === false` hoặc HTTP không thành công.
 * - Bắt cả lỗi mạng (server sập, mất kết nối) thành ApiError để UI xử lý.
 * - Tự xoá token khi nhận HTTP 401 (session hết hạn).
 */
export async function apiRequest<TData>(
  path: string,
  options: RequestOptions = {},
): Promise<TData> {
  const { method = "GET", body, signal } = options

  // Build headers
  const headers: Record<string, string> = {}
  if (body) headers["Content-Type"] = "application/json"
  const token = getStoredToken()
  if (token) headers["Authorization"] = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    // Lỗi mạng: server không phản hồi, DNS, CORS, offline...
    throw new ApiError(
      "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
      0,
      "NETWORK_ERROR",
    )
  }

  // Auto-logout khi token hết hạn
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY)
      // Dispatch custom event để AuthProvider bắt và clear state
      window.dispatchEvent(new CustomEvent("auth:logout"))
    }
  }

  // Một số lỗi hạ tầng (429/503 từ proxy) có thể không trả JSON chuẩn.
  let payload: ApiResponse<TData> | null = null
  try {
    payload = (await response.json()) as ApiResponse<TData>
  } catch {
    payload = null
  }

  if (!response.ok || !payload?.success) {
    const message =
      payload?.message ??
      (response.status === 429
        ? "Hệ thống đang quá tải, vui lòng thử lại sau giây lát."
        : response.status === 503
          ? "Máy chủ đang bận. Vui lòng thử lại."
          : "Đã có lỗi xảy ra, vui lòng thử lại.")
    throw new ApiError(message, response.status, payload?.error ?? null)
  }

  return payload.data as TData
}
