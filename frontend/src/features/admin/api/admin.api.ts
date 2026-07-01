import { useQuery } from "@tanstack/react-query"

import { apiRequest } from "@/lib/api-client"
import type { AdminStats } from "@/types/api"

/** GET /admin/stats */
export function getAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats")
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    // Dashboard tự làm mới định kỳ để phản ánh vé được giữ / bán / nhả.
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  })
}
