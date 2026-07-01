import { Link } from "@tanstack/react-router"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import type { PaymentResult } from "@/types/api"
import { groupTicketsByType } from "./ticket-summary"

interface PaymentSuccessProps {
  payment: PaymentResult
  onBookAnother: () => void
}

export function PaymentSuccess({ payment, onBookAnother }: PaymentSuccessProps) {
  const groups = groupTicketsByType(payment.tickets)

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="size-8" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Thanh toán thành công!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {payment.tickets.length} vé đã được xác nhận. Hẹn gặp bạn tại sự kiện.
      </p>

      <dl className="mt-6 w-full space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        {groups.map((group) => (
          <div key={group.type}>
            <div className="flex justify-between font-medium">
              <span className="truncate">
                {group.type} × {group.count}
              </span>
              <span className="tabular-nums">
                {formatCurrency(group.subtotal)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {group.tickets.map((t) => (
                <span
                  key={t.id}
                  className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {t.code}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-3 font-semibold">
          <span>Tổng</span>
          <span>{formatCurrency(payment.order.totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mã đơn</dt>
          <dd className="font-mono text-xs">{payment.order.id}</dd>
        </div>
      </dl>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onBookAnother}>
          Đặt thêm vé
        </Button>
        <Button asChild className="bg-brand hover:bg-brand/90">
          <Link to="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  )
}
