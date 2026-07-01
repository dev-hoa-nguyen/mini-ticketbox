import type { Ticket } from "@/types/api"

export interface TicketGroup {
  type: string
  count: number
  subtotal: number
  tickets: Ticket[]
}

/** Gom danh sách vé theo loại để hiển thị tóm tắt (đơn giá đồng nhất trong 1 loại). */
export function groupTicketsByType(tickets: Ticket[]): TicketGroup[] {
  const groups = new Map<string, TicketGroup>()
  for (const ticket of tickets) {
    const group = groups.get(ticket.type)
    if (group) {
      group.count += 1
      group.subtotal += Number(ticket.price)
      group.tickets.push(ticket)
    } else {
      groups.set(ticket.type, {
        type: ticket.type,
        count: 1,
        subtotal: Number(ticket.price),
        tickets: [ticket],
      })
    }
  }
  return [...groups.values()]
}
