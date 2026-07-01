import { createFileRoute } from "@tanstack/react-router"
import { CheckoutFlow } from "@/features/checkout/ui/CheckoutFlow"

export const Route = createFileRoute("/book")({ component: BookingPage })

function BookingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Quầy đặt vé
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn vé bên trái, kiểm tra giỏ bên phải. Giữ chỗ 5 phút sau khi đặt.
        </p>
      </div>

      <CheckoutFlow />
    </div>
  )
}
