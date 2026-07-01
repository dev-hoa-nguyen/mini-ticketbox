const USER_ID_KEY = "ticketbox:userId"
export const TOKEN_KEY = "ticketbox:token"

/**
 * Danh tính "khách" phía client. Backend nhận userId dạng UUID và
 * tự upsert User, nên ta chỉ cần sinh & lưu 1 UUID ổn định trong localStorage.
 * SSR-safe: khi không có `window` trả về UUID tạm (không đọc storage).
 */
export function getUserId(): string {
  if (typeof window === "undefined") return crypto.randomUUID()

  let userId = window.localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    window.localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

/** Lấy auth token từ localStorage (SSR-safe). */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

/** Kiểm tra nhanh xem có token không (SSR-safe). */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}
