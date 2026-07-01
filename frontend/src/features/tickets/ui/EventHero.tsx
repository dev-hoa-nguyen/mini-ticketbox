import { Link } from "@tanstack/react-router"
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EVENT } from "../constants"
import { TicketCounter } from "./TicketCounter"

export function EventHero() {
  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-20">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 text-brand" />
          Chống over-selling · Giữ vé 5 phút
        </span>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          {EVENT.name}
        </h1>

        <div className="mt-4 space-y-1.5 text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {EVENT.date}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4" />
            {EVENT.venue}
          </p>
        </div>

        <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Giới hạn 500 vé. Khi cổng mở, hàng ngàn người cùng tranh vé — hệ thống
          đảm bảo mỗi vé chỉ thuộc về đúng một người, không bao giờ bán vượt số
          lượng.
        </p>

        <div className="mt-6 flex gap-3">
          <Button asChild size="lg" className="bg-brand hover:bg-brand/90">
            <Link to="/book">Đặt vé ngay</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/admin">Xem thống kê</Link>
          </Button>
        </div>
      </div>

      <TicketCounter />
    </section>
  )
}
