import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number | null
  icon: LucideIcon
  accentClassName?: string
  hint?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName,
  hint,
}: StatCardProps) {
  return (
    <Card className="py-5">
      <CardContent className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === null ? (
            <Skeleton className="mt-2 h-9 w-24" />
          ) : (
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
              {value}
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            accentClassName,
          )}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  )
}
