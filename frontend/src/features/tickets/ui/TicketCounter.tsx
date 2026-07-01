import { Radio, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TOTAL_TICKETS } from "../constants"
import { useTicketStream } from "../hooks/useTicketStream"

/**
 * Hiển thị số vé còn lại theo thời gian thực (SSE).
 * Có trạng thái Live / Reconnecting để user biết dữ liệu có đang cập nhật hay không.
 */
export function TicketCounter() {
  const { availableCount, status, isLive } = useTicketStream()

  const remaining = availableCount ?? 0
  const sold = Math.max(0, TOTAL_TICKETS - remaining)
  const soldPercent = (sold / TOTAL_TICKETS) * 100
  const isSoldOut = availableCount !== null && remaining <= 0

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Vé còn lại
        </span>
        {isLive ? (
          <Badge variant="success">
            <Radio className="size-3 animate-pulse" />
            Trực tiếp
          </Badge>
        ) : (
          <Badge variant="warning">
            <WifiOff className="size-3" />
            Đang kết nối lại…
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        {availableCount === null ? (
          <Skeleton className="h-12 w-28" />
        ) : (
          <span
            className={cn(
              "text-5xl font-bold tracking-tight tabular-nums",
              isSoldOut ? "text-destructive" : "text-brand"
            )}
          >
            {remaining}
          </span>
        )}
        <span className="pb-1 text-lg text-muted-foreground">
          / {TOTAL_TICKETS}
        </span>
      </div>

      <Progress
        value={soldPercent}
        className="mt-4"
        indicatorClassName={isSoldOut ? "bg-destructive" : "bg-brand"}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Đã bán {sold} / {TOTAL_TICKETS} vé
        {status === "reconnecting" &&
          " · Mất kết nối tạm thời, số liệu có thể chưa mới nhất."}
      </p>
    </div>
  )
}
