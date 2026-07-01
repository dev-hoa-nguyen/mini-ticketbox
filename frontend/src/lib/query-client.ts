import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api-client"

/**
 * Factory tạo QueryClient. Một instance / lần render (tránh share state giữa
 * các request khi SSR).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        retry: (failureCount, error) => {
          // Không retry lỗi logic 4xx (trừ 429). Chỉ thử lại khi quá tải/mạng.
          if (error instanceof ApiError) {
            if (error.isOverloaded || error.status === 0) return failureCount < 3
            return false
          }
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}
