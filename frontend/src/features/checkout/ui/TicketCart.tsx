import * as React from "react"
import { Loader2, Minus, Plus, Radio, Ticket, WifiOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { HoldCartPayload, TicketType } from "@/types/api"
import { useTicketTypes } from "@/features/tickets/api/tickets.api"
import { useTicketStream } from "@/features/tickets/hooks/useTicketStream"

/** Trùng với backend MAX_TICKETS_PER_ORDER. */
const MAX_TICKETS_PER_ORDER = 10
const EMAIL_KEY = "ticketbox:email"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface TicketCartProps {
  onCheckout: (payload: HoldCartPayload) => void
  isPending: boolean
}

/**
 * Quầy đặt vé kiểu máy POS: danh sách vé bên trái, giỏ vé (cuống vé) bên phải.
 * Chạm vào 1 loại vé để thêm nhanh; dùng nút − / + để chỉnh chính xác.
 */
export function TicketCart({ onCheckout, isPending }: TicketCartProps) {
  const {
    data: types,
    isPending: isLoading,
    isError,
    refetch,
  } = useTicketTypes()
  const { byType, isLive } = useTicketStream()

  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [email, setEmail] = React.useState("")
  const [emailTouched, setEmailTouched] = React.useState(false)
  const emailRef = React.useRef<HTMLInputElement>(null)

  // Khôi phục email đã dùng lần trước cho tiện.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem(EMAIL_KEY)
    if (saved) setEmail(saved)
  }, [])

  const availableOf = React.useCallback(
    (t: TicketType) => Math.min(byType?.[t.type] ?? t.available, t.total),
    [byType]
  )

  const totalQty = Object.values(quantities).reduce((sum, n) => sum + n, 0)
  const totalPrice = (types ?? []).reduce(
    (sum, t) => sum + Number(t.price) * (quantities[t.type] || 0),
    0
  )
  const isEmailValid = EMAIL_RE.test(email.trim())

  const setQty = (type: string, next: number) =>
    setQuantities((prev) => ({ ...prev, [type]: Math.max(0, next) }))

  const addOne = (t: TicketType) => {
    const qty = quantities[t.type] || 0
    if (qty < availableOf(t) && totalQty < MAX_TICKETS_PER_ORDER) {
      setQty(t.type, qty + 1)
    }
  }

  const submit = () => {
    if (totalQty === 0) return
    if (!isEmailValid) {
      setEmailTouched(true)
      emailRef.current?.focus()
      emailRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
      return
    }
    if (isPending) return
    const trimmed = email.trim()
    if (typeof window !== "undefined")
      window.localStorage.setItem(EMAIL_KEY, trimmed)
    const items = (types ?? [])
      .filter((t) => (quantities[t.type] || 0) > 0)
      .map((t) => ({ type: t.type, quantity: quantities[t.type] }))
    onCheckout({ email: trimmed, items })
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <WifiOff />
        <div>
          <AlertTitle>Không tải được danh sách vé</AlertTitle>
          <AlertDescription>
            <button className="underline" onClick={() => refetch()}>
              Thử lại
            </button>
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  const cartLines = types.filter((t) => (quantities[t.type] || 0) > 0)
  const isCartFull = totalQty >= MAX_TICKETS_PER_ORDER

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_360px] lg:items-start lg:pb-0">
      {/* ============ TRÁI: DANH SÁCH VÉ ============ */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Danh sách vé
          </h2>
          <Badge variant={isLive ? "success" : "warning"}>
            {isLive ? (
              <Radio className="size-3 animate-pulse" />
            ) : (
              <WifiOff className="size-3" />
            )}
            {isLive ? "Trực tiếp" : "Kết nối lại…"}
          </Badge>
        </div>

        <div className="mt-3 space-y-3">
          {types.map((t) => {
            const available = availableOf(t)
            const qty = quantities[t.type] || 0
            const isSoldOut = available <= 0
            const canAdd = qty < available && !isCartFull
            const soldPercent =
              t.total > 0 ? ((t.total - available) / t.total) * 100 : 0
            const isPicked = qty > 0

            return (
              <div
                key={t.type}
                role="button"
                tabIndex={isSoldOut ? -1 : 0}
                aria-disabled={isSoldOut}
                aria-label={`Thêm 1 vé ${t.type}`}
                onClick={() => !isSoldOut && addOne(t)}
                onKeyDown={(e) => {
                  if (isSoldOut) return
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    addOne(t)
                  }
                }}
                className={cn(
                  "rounded-2xl border bg-card p-5 text-left transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSoldOut
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-brand/50",
                  isPicked && "border-brand ring-1 ring-brand/30"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <Ticket className="size-4 shrink-0 text-brand" />
                      <span className="truncate">{t.type}</span>
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold text-brand">
                      {formatCurrency(t.price)}
                    </p>
                  </div>
                  {isSoldOut ? (
                    <Badge variant="destructive">Hết vé</Badge>
                  ) : (
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      Còn
                      <span
                        className={cn(
                          "ml-1 font-mono text-sm font-bold",
                          available <= 20
                            ? "text-destructive"
                            : "text-foreground"
                        )}
                      >
                        {available}
                      </span>
                      /{t.total}
                    </span>
                  )}
                </div>

                {/* Thanh tồn kho mảnh */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full motion-safe:transition-[width] motion-safe:duration-500",
                      isSoldOut ? "bg-destructive" : "bg-brand"
                    )}
                    style={{ width: `${soldPercent}%` }}
                  />
                </div>

                {/* Hàng thao tác: gợi ý chạm HOẶC bộ đếm số lượng */}
                <div className="mt-4 flex h-9 items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {isPicked
                      ? "Trong giỏ"
                      : isSoldOut
                        ? "Đã bán hết"
                        : "Chạm để thêm vào giỏ"}
                  </span>

                  {isPicked && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9"
                        aria-label={`Bớt 1 vé ${t.type}`}
                        disabled={isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          setQty(t.type, qty - 1)
                        }}
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center font-mono text-lg font-semibold tabular-nums">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9"
                        aria-label={`Thêm 1 vé ${t.type}`}
                        disabled={!canAdd || isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          addOne(t)
                        }}
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============ PHẢI: CUỐNG VÉ / GIỎ HÀNG ============ */}
      <aside className="lg:sticky lg:top-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 font-semibold">
            <Ticket className="size-4 text-brand" />
            Vé của bạn
            {totalQty > 0 && (
              <span className="ml-auto rounded-full bg-brand px-2 py-0.5 font-mono text-xs font-bold text-brand-foreground">
                {totalQty}
              </span>
            )}
          </div>

          {/* Đường xé răng cưa của cuống vé */}
          <div className="relative">
            <div className="border-t border-dashed border-border" />
            <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-background" />
            <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-background" />
          </div>

          <div className="px-5 py-4">
            {totalQty === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Giỏ đang trống.
                <br />
                Chạm một loại vé bên trái để bắt đầu.
              </p>
            ) : (
              <ul className="space-y-2 font-mono text-sm">
                {cartLines.map((t) => (
                  <li key={t.type} className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">
                      {quantities[t.type]}×
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.type}</span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        Number(t.price) * (quantities[t.type] || 0)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-end justify-between border-t border-dashed border-border pt-4">
              <span className="text-sm text-muted-foreground">
                Tổng cộng{totalQty > 0 && ` · ${totalQty} vé`}
              </span>
              <span className="font-mono text-2xl font-bold text-brand">
                {formatCurrency(totalPrice)}
              </span>
            </div>

            {isCartFull && (
              <p className="mt-2 text-xs text-muted-foreground">
                Đã đạt tối đa {MAX_TICKETS_PER_ORDER} vé mỗi đơn.
              </p>
            )}

            {/* Xác minh email */}
            <div className="mt-4 space-y-1.5">
              <label htmlFor="buyer-email" className="text-sm font-medium">
                Email nhận vé
              </label>
              <Input
                id="buyer-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ban@email.com"
                value={email}
                disabled={isPending}
                aria-invalid={emailTouched && !isEmailValid}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
              />
              {emailTouched && !isEmailValid && (
                <p className="text-xs text-destructive">
                  Nhập email hợp lệ để xác minh và nhận vé.
                </p>
              )}
            </div>

            <Button
              className="mt-4 w-full bg-brand hover:bg-brand/90"
              size="lg"
              disabled={totalQty === 0 || isPending}
              onClick={submit}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Đang giữ vé…
                </>
              ) : (
                "Đặt vé"
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* ============ THANH ĐÁY DÍNH (MOBILE) ============ */}
      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-1">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{totalQty} vé</p>
              <p className="truncate font-mono text-lg font-bold text-brand">
                {formatCurrency(totalPrice)}
              </p>
            </div>
            <Button
              className="ml-auto bg-brand hover:bg-brand/90"
              size="lg"
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? <Loader2 className="animate-spin" /> : "Đặt vé"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
