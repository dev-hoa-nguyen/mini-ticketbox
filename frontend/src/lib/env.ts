/** Cấu hình runtime lấy từ biến môi trường Vite (an toàn cho SSR). */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8080/api"
