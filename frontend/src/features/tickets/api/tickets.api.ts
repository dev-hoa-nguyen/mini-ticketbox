import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import type { TicketType } from "@/types/api"

/** GET /tickets/types — danh sách loại vé (giá, tổng, số còn trống). */
export function fetchTicketTypes(): Promise<TicketType[]> {
  return apiRequest<TicketType[]>("/tickets/types")
}

/** Query hook: cấu trúc loại vé (giá/tổng) tải 1 lần; số vé trống cập nhật thêm qua SSE. */
export function useTicketTypes() {
  return useQuery({
    queryKey: ["ticket-types"],
    queryFn: fetchTicketTypes,
  })
}
