/**
 * Types đồng bộ với Backend (Prisma schema + response chuẩn hoá).
 * Lưu ý: Prisma serialize `Decimal` thành `string` trong JSON,
 * nên `price` / `totalAmount` luôn là string ở phía client.
 */

export type TicketStatus = "AVAILABLE" | "HOLD" | "SOLD"

export type OrderStatus = "PENDING" | "COMPLETED" | "EXPIRED"

/** Response chuẩn hoá của mọi endpoint backend. */
export interface ApiResponse<TData> {
  success: boolean
  data: TData | null
  error: string | null
  message: string
}

export interface Ticket {
  id: string
  code: string
  price: string
  status: TicketStatus
  type: string
  orderId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  userId: string
  totalAmount: string
  status: OrderStatus
  expiresAt: string
  createdAt: string
  updatedAt: string
}

/** 1 dòng trong giỏ vé (client gửi lên khi giữ vé). */
export interface CartItem {
  type: string
  quantity: number
}

/** Body của POST /tickets/hold (giữ giỏ vé + xác minh email). */
export interface HoldCartPayload {
  email: string
  name?: string
  items: CartItem[]
}

/** POST /tickets/hold -> data (giỏ vé: 1 order, nhiều vé) */
export interface HoldResult {
  order: Order
  tickets: Ticket[]
}

/** POST /tickets/pay -> data */
export interface PaymentResult {
  order: Order
  tickets: Ticket[]
}

/** GET /tickets/types -> data[] */
export interface TicketType {
  type: string
  /** Prisma Decimal serialize thành string. */
  price: string
  total: number
  available: number
}

/** Thống kê 1 loại vé trên dashboard admin. */
export interface TicketTypeStat {
  type: string
  price: number
  total: number
  available: number
  hold: number
  sold: number
  revenue: number
}

/** GET /admin/stats -> data */
export interface AdminStats {
  tickets: {
    total: number
    available: number
    hold: number
    sold: number
  }
  revenue: number | string
  /** Bóc tách theo từng loại vé. */
  byType: TicketTypeStat[]
}

/** Payload event của SSE /tickets/stream */
export interface TicketStreamEvent {
  availableCount: number
  /** Số vé trống theo từng loại (real-time). */
  byType?: Record<string, number>
}

/** User profile from auth endpoints */
export interface AuthUser {
  id: string
  email: string
  name: string
  createdAt: string
}

/** POST /auth/register & POST /auth/login → data */
export interface AuthResult {
  user: AuthUser
  token: string
}

/** GET /auth/me/orders → data (order with nested ticket) */
export interface OrderWithTicket extends Order {
  ticket: Ticket | null
}
