import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import viteReact from "@vitejs/plugin-react"

// Config riêng cho test: KHÔNG nạp tanstackStart plugin (SSR transform) để render
// component thuần trong jsdom. Alias `@` trỏ tới src.
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
})
