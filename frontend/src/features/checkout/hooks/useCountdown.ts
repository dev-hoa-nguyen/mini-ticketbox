import * as React from "react"

import { formatCountdown } from "@/lib/format"

interface UseCountdownResult {
  /** Số giây còn lại (đã làm tròn). */
  secondsLeft: number
  /** Chuỗi "MM:SS" hiển thị. */
  formatted: string
  minutes: number
  seconds: number
  isExpired: boolean
}

/**
 * Đếm ngược tới mốc `expiresAt` (ISO string từ server).
 *
 * CRITICAL: KHÔNG khởi tạo bằng `Date.now() + 5m`. Timer luôn tính lại
 * `expiresAt(server) − now` ở mỗi tick, nên:
 * - Không thể bị chỉnh giờ phía client để kéo dài thời gian giữ vé.
 * - Không lệch khi tab bị throttle ở background hay máy client lag.
 */
export function useCountdown(expiresAt: string | null): UseCountdownResult {
  const targetMs = React.useMemo(
    () => (expiresAt ? new Date(expiresAt).getTime() : 0),
    [expiresAt],
  )

  const compute = React.useCallback(() => {
    if (!targetMs) return 0
    return Math.max(0, Math.round((targetMs - Date.now()) / 1000))
  }, [targetMs])

  const [secondsLeft, setSecondsLeft] = React.useState(compute)

  React.useEffect(() => {
    if (!targetMs) {
      setSecondsLeft(0)
      return
    }
    setSecondsLeft(compute())
    const interval = setInterval(() => {
      const next = compute()
      setSecondsLeft(next)
      if (next <= 0) clearInterval(interval)
    }, 250)
    return () => clearInterval(interval)
  }, [targetMs, compute])

  return {
    secondsLeft,
    formatted: formatCountdown(secondsLeft),
    minutes: Math.floor(secondsLeft / 60),
    seconds: secondsLeft % 60,
    isExpired: targetMs > 0 && secondsLeft <= 0,
  }
}
