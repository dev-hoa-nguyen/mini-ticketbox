import { Clock } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { formatCountdown } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Tổng thời gian giữ vé = 5 phút (khớp backend HOLD_TIME_SECONDS). */
const HOLD_TOTAL_SECONDS = 300

export function CountdownTimer({ secondsLeft }: { secondsLeft: number }) {
  const percent = (secondsLeft / HOLD_TOTAL_SECONDS) * 100
  const isUrgent = secondsLeft <= 60

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isUrgent
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-4" />
          Thời gian giữ vé
        </span>
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            isUrgent ? "text-destructive" : "text-foreground",
          )}
        >
          {formatCountdown(secondsLeft)}
        </span>
      </div>
      <Progress
        value={percent}
        className="mt-3"
        indicatorClassName={isUrgent ? "bg-destructive" : "bg-brand"}
      />
      {isUrgent && (
        <p className="mt-2 text-xs text-destructive">
          Sắp hết thời gian! Vé sẽ tự động nhả lại nếu bạn không thanh toán.
        </p>
      )}
    </div>
  )
}
