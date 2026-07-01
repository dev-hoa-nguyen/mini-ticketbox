import * as React from "react"

import { API_URL } from "@/lib/env"
import type { TicketStreamEvent } from "@/types/api"

export type StreamStatus = "connecting" | "open" | "reconnecting"

interface UseTicketStreamResult {
  /** Số vé còn trống theo thời gian thực. `null` khi chưa nhận được dữ liệu nào. */
  availableCount: number | null
  /** Số vé trống theo từng loại (real-time). `null` khi chưa có dữ liệu. */
  byType: Record<string, number> | null
  status: StreamStatus
  isLive: boolean
}

const MAX_BACKOFF_MS = 10_000

/**
 * Lắng nghe số vé còn trống qua Server-Sent Events (`GET /tickets/stream`).
 *
 * Resilience:
 * - `EventSource` tự reconnect với transient drop; nhưng nếu server trả HTTP lỗi
 *   (503 khi quá tải) nó sẽ đóng hẳn. Ta tự mở lại với exponential backoff.
 * - Chạy hoàn toàn ở client (guard `window`) để an toàn khi SSR.
 */
export function useTicketStream(): UseTicketStreamResult {
  const [availableCount, setAvailableCount] = React.useState<number | null>(null)
  const [byType, setByType] = React.useState<Record<string, number> | null>(null)
  const [status, setStatus] = React.useState<StreamStatus>("connecting")

  React.useEffect(() => {
    if (typeof window === "undefined") return

    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let isDisposed = false

    const connect = () => {
      if (isDisposed) return
      source = new EventSource(`${API_URL}/tickets/stream`)

      source.onopen = () => {
        attempt = 0
        setStatus("open")
      }

      source.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as TicketStreamEvent
          if (typeof data.availableCount === "number") {
            setAvailableCount(data.availableCount)
          }
          if (data.byType && typeof data.byType === "object") {
            setByType(data.byType)
          }
        } catch {
          // Bỏ qua message không hợp lệ, giữ giá trị cũ.
        }
      }

      source.onerror = () => {
        // Đóng kết nối hỏng và tự mở lại (không phụ thuộc auto-retry của trình duyệt).
        source?.close()
        if (isDisposed) return
        setStatus("reconnecting")
        const backoff = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
        attempt += 1
        retryTimer = setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      isDisposed = true
      if (retryTimer) clearTimeout(retryTimer)
      source?.close()
    }
  }, [])

  return {
    availableCount,
    byType,
    status,
    isLive: status === "open",
  }
}
