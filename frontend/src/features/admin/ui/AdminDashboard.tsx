import {
  CircleDollarSign,
  Lock,
  RefreshCw,
  Ticket,
  TicketCheck,
  TriangleAlert,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TicketTypeStat } from "@/types/api"
import { useAdminStats } from "../api/admin.api"
import { StatCard } from "./StatCard"

export function AdminDashboard() {
  const { data, isPending, isError, error, isFetching, refetch } =
    useAdminStats()

  const tickets = data?.tickets
  const byType = data?.byType ?? []
  const total = tickets?.total ?? 0
  const soldPercent = total ? ((tickets?.sold ?? 0) / total) * 100 : 0
  const holdPercent = total ? ((tickets?.hold ?? 0) / total) * 100 : 0
  const availablePercent = Math.max(0, 100 - soldPercent - holdPercent)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bảng điều khiển</h1>
          <p className="mt-1 text-muted-foreground">
            Thống kê vé &amp; doanh thu theo thời gian thực.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={isFetching}
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
            {"Làm mới"}
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert />
          <div>
            <AlertTitle>Không tải được thống kê</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Vui lòng thử lại."}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vé còn trống"
          value={isPending ? null : (tickets?.available ?? 0)}
          icon={Ticket}
          accentClassName="bg-brand/10 text-brand"
        />
        <StatCard
          label="Đang giữ (khoá tạm)"
          value={isPending ? null : (tickets?.hold ?? 0)}
          icon={Lock}
          accentClassName="bg-amber-500/10 text-amber-500"
          hint="Sẽ nhả lại sau 5 phút nếu không thanh toán"
        />
        <StatCard
          label="Đã bán"
          value={isPending ? null : (tickets?.sold ?? 0)}
          icon={TicketCheck}
          accentClassName="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          label="Doanh thu"
          value={isPending ? null : formatCurrency(data?.revenue ?? 0)}
          icon={CircleDollarSign}
          accentClassName="bg-brand/10 text-brand"
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Phân bổ kho vé ({total} vé)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${soldPercent}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-[width] duration-500"
              style={{ width: `${holdPercent}%` }}
            />
            <div
              className="h-full bg-brand/30 transition-[width] duration-500"
              style={{ width: `${availablePercent}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <LegendRow
              color="bg-emerald-500"
              label="Đã bán"
              value={tickets?.sold ?? 0}
            />
            <LegendRow
              color="bg-amber-500"
              label="Đang giữ"
              value={tickets?.hold ?? 0}
            />
            <LegendRow
              color="bg-brand/30"
              label="Còn trống"
              value={tickets?.available ?? 0}
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Tỉ lệ lấp đầy</span>
              <span>{Math.round(soldPercent)}%</span>
            </div>
            <Progress value={soldPercent} indicatorClassName="bg-emerald-500" />
          </div>
        </CardContent>
      </Card>

      {/* Bóc tách theo từng loại vé */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Thống kê theo loại vé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isPending && byType.length === 0 ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (
            byType.map((t) => <TypeStatRow key={t.type} stat={t} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TypeStatRow({ stat }: { stat: TicketTypeStat }) {
  const { type, price, total, available, hold, sold, revenue } = stat
  const pct = (n: number) => (total ? (n / total) * 100 : 0)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <Ticket className="size-4 text-brand" />
          <span>{type}</span>
          <span className="text-sm font-normal text-muted-foreground">
            · {formatCurrency(price)}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Doanh thu: </span>
          <span className="font-semibold text-brand tabular-nums">
            {formatCurrency(revenue)}
          </span>
        </div>
      </div>

      {/* Thanh phân bổ đã bán / đang giữ / còn trống */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${pct(sold)}%` }}
        />
        <div
          className="h-full bg-amber-500 transition-[width] duration-500"
          style={{ width: `${pct(hold)}%` }}
        />
        <div
          className="h-full bg-brand/30 transition-[width] duration-500"
          style={{ width: `${pct(available)}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3 text-sm sm:grid-cols-4">
        <LegendRow color="bg-emerald-500" label="Đã bán" value={sold} />
        <LegendRow color="bg-amber-500" label="Đang giữ" value={hold} />
        <LegendRow color="bg-brand/30" label="Còn trống" value={available} />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Tổng</span>
          <span className="ml-auto font-semibold tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  )
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-3 rounded-sm", color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </div>
  )
}
