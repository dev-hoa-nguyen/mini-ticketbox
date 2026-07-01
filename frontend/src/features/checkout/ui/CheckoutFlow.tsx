import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Ticket, TimerOff } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import type { HoldCartPayload, HoldResult, PaymentResult } from "@/types/api"
import { holdCart, payOrder } from "../api/checkout.api"
import { useCountdown } from "../hooks/useCountdown"
import { groupTicketsByType } from "./ticket-summary"
import { CountdownTimer } from "./CountdownTimer"
import { TicketCart } from "./TicketCart"
import { PaymentSuccess } from "./PaymentSuccess"

type Step = "booking" | "payment" | "success"

const STORAGE_KEY = "ticketbox:activeHold"

/**
 * Layout effect chạy TRƯỚC khi trình duyệt paint -> khôi phục hold không bị
 * "nháy" bước Booking sau F5. SSR không có layout effect nên fallback useEffect
 * (server vốn không đọc được localStorage, luôn render Booking).
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/** Trích message thân thiện từ lỗi API (đã map sẵn `message` trong ApiError). */
function toErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Đã có lỗi xảy ra, vui lòng thử lại."
}

/** Khôi phục hold còn hiệu lực sau refresh; bỏ qua nếu đã hết hạn. */
function loadStoredHold(): HoldResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HoldResult
    if (new Date(parsed.order.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function storeHold(hold: HoldResult | null): void {
  if (typeof window === "undefined") return
  if (hold) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hold))
  else window.localStorage.removeItem(STORAGE_KEY)
}

/**
 * Toàn bộ luồng đặt vé trong 1 component, điều hướng bằng local state `step`
 * (booking → payment → success) — không cần router.
 */
export function CheckoutFlow() {
  const [step, setStep] = React.useState<Step>("booking")
  const [hold, setHold] = React.useState<HoldResult | null>(null)
  const [payment, setPayment] = React.useState<PaymentResult | null>(null)

  // Khôi phục hold đang giữ nếu user refresh / quay lại trang giữa chừng.
  useIsomorphicLayoutEffect(() => {
    const stored = loadStoredHold()
    if (stored) {
      setHold(stored)
      setStep("payment")
    }
  }, [])

  // Đồng hồ chỉ chạy ở bước thanh toán, dựa hoàn toàn vào expiresAt của server.
  const { secondsLeft, isExpired } = useCountdown(
    step === "payment" ? (hold?.order.expiresAt ?? null) : null,
  )

  const isOrderExpired = step === "payment" && isExpired

  // Dọn localStorage ngay khi hết hạn để refresh không khôi phục lại.
  React.useEffect(() => {
    if (isOrderExpired) storeHold(null)
  }, [isOrderExpired])

  const bookMutation = useMutation({
    mutationFn: (payload: HoldCartPayload) => holdCart(payload),
    onSuccess: (data) => {
      setHold(data)
      setPayment(null)
      storeHold(data)
      setStep("payment")
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })

  const payMutation = useMutation({
    mutationFn: (orderId: string) => payOrder(orderId),
    onSuccess: (data) => {
      setPayment(data)
      storeHold(null)
      setStep("success")
      toast.success("Thanh toán thành công! Vé của bạn đã được xác nhận.")
    },
    onError: (error) => toast.error(toErrorMessage(error)),
  })

  const resetToBooking = React.useCallback(() => {
    bookMutation.reset()
    payMutation.reset()
    setHold(null)
    setPayment(null)
    storeHold(null)
    setStep("booking")
  }, [bookMutation, payMutation])

  // STEP 1: BOOKING — giỏ vé nhiều loại + xác minh email.
  if (step === "booking") {
    return (
      <TicketCart
        onCheckout={(payload) => bookMutation.mutate(payload)}
        isPending={bookMutation.isPending}
      />
    )
  }

  const activeTickets = payment?.tickets ?? hold?.tickets ?? []
  const ticketGroups = groupTicketsByType(activeTickets)

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-5 text-brand" />
            {activeTickets.length} vé{step === "success" ? " đã mua" : " đang giữ"}
          </CardTitle>
          {step === "payment" && !isOrderExpired && (
            <Badge variant="warning">Đang giữ</Badge>
          )}
          {step === "success" && <Badge variant="success">Đã bán</Badge>}
        </div>
        <CardDescription>
          Giữ vé để khoá chỗ trong 5 phút, hoàn tất thanh toán để xác nhận.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* STEP 2: PAYMENT */}
        {step === "payment" && hold && (
          <>
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              {ticketGroups.map((group) => (
                <div key={group.type}>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="truncate">
                      {group.type} × {group.count}
                    </span>
                    <span className="tabular-nums text-brand">
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
                <span>Tổng ({activeTickets.length} vé)</span>
                <span className="text-brand">
                  {formatCurrency(hold.order.totalAmount)}
                </span>
              </div>
            </div>

            {isOrderExpired ? (
              <>
                <Alert variant="destructive">
                  <TimerOff />
                  <div>
                    <AlertTitle>Order Expired</AlertTitle>
                    <AlertDescription>
                      Đã quá 5 phút. Vé được nhả lại vào kho cho người khác.
                    </AlertDescription>
                  </div>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Back to Home</Link>
                </Button>
              </>
            ) : (
              <>
                <CountdownTimer secondsLeft={secondsLeft} />
                <Button
                  className="w-full bg-brand hover:bg-brand/90"
                  size="lg"
                  onClick={() => payMutation.mutate(hold.order.id)}
                  disabled={payMutation.isPending}
                >
                  {payMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Đang xử lý…
                    </>
                  ) : (
                    `Confirm Payment · ${formatCurrency(hold.order.totalAmount)}`
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Thanh toán giả lập — không trừ tiền thật.
                </p>
              </>
            )}
          </>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "success" && payment && (
          <PaymentSuccess payment={payment} onBookAnother={resetToBooking} />
        )}
      </CardContent>
    </Card>
  )
}
