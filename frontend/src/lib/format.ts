/** Định dạng tiền tệ VND. Chấp nhận string (Prisma Decimal) hoặc number. */
export function formatCurrency(value: string | number): string {
  const amount = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Giây -> "mm:ss" cho đồng hồ đếm ngược. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
