import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createQueryClient } from "@/lib/query-client"
import type { HoldResult } from "@/types/api"

// Mock router Link (không có RouterProvider trong test) + api layer.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock("../api/checkout.api", () => ({
  holdCart: vi.fn(),
  payOrder: vi.fn(),
}))
// Bước booking hiển thị giỏ vé; ở đây chỉ cần stub để test luồng khôi phục.
vi.mock("./TicketCart", () => ({
  TicketCart: () => <button>Book Ticket</button>,
}))

import { CheckoutFlow } from "./CheckoutFlow"

const STORAGE_KEY = "ticketbox:activeHold"

function makeHold(expiresInMs: number): HoldResult {
  return {
    order: {
      id: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      totalAmount: "500000",
      status: "PENDING",
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    tickets: [
      {
        id: "33333333-3333-3333-3333-333333333333",
        code: "VIP-A123",
        price: "500000",
        status: "HOLD",
        type: "TIER S - ZONE A",
        orderId: "11111111-1111-1111-1111-111111111111",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  }
}

function renderFlow() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CheckoutFlow />
    </QueryClientProvider>,
  )
}

describe("CheckoutFlow — khôi phục hold sau reload / đổi trang", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it("hold còn hạn -> mount thẳng vào Payment, hiện mã vé + giá đang giữ", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeHold(120_000)))

    renderFlow()

    // Bỏ qua bước Booking, hiện thông tin vé đang hold.
    expect(await screen.findByText("VIP-A123")).toBeTruthy()
    expect(screen.getByText(/Confirm Payment/i)).toBeTruthy()
    expect(screen.queryByText("Book Ticket")).toBeNull()
  })

  it("hold đã hết hạn -> KHÔNG khôi phục, quay về bước Booking + xoá localStorage", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeHold(-1_000)))

    renderFlow()

    expect(await screen.findByText("Book Ticket")).toBeTruthy()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("không có hold -> hiện bước Booking bình thường", async () => {
    renderFlow()
    expect(await screen.findByText("Book Ticket")).toBeTruthy()
  })
})
