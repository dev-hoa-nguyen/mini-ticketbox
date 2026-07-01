import { jest } from "@jest/globals";

// ESM: jest.mock KHÔNG được hoist như CommonJS.
// Phải dùng unstable_mockModule + dynamic import() sau khi mock.
const mockHoldTicketAtomic = jest.fn();
const mockDel = jest.fn();
const mockSadd = jest.fn();
const mockTransaction = jest.fn();

const REDIS_KEYS = {
  AVAILABLE_TICKETS: "tickets:available",
  HOLD_PREFIX: "ticket:hold:",
};

// Mock module Redis (đường dẫn alias phải khớp với source: @/database/redis)
jest.unstable_mockModule("@/database/redis", () => ({
  redis: {
    holdTicketAtomic: mockHoldTicketAtomic,
    defineCommand: jest.fn(), // ticket.service gọi lúc load module
    del: mockDel,
    sadd: mockSadd,
  },
  REDIS_KEYS,
}));

// Mock module Prisma
jest.unstable_mockModule("@/database/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

// Import động SAU khi đã đăng ký mock
const { TicketService } = await import("../ticket.service");

describe("TicketService.holdTicket", () => {
  const mockUserId = "test-user-uuid";
  const mockTicketId = "TICKET-001";

  afterEach(() => {
    jest.clearAllMocks(); // Xóa lịch sử gọi hàm sau mỗi test case
  });

  it("Trường hợp 1: Giữ vé thành công khi Redis còn vé và DB hoạt động tốt", async () => {
    // Giả lập Redis báo thành công (status = 1) và trả về ticketId
    mockHoldTicketAtomic.mockResolvedValue([1, mockTicketId]);

    // Giả lập DB lưu thành công
    const mockDbResult = {
      order: { id: "order-1" },
      ticket: { id: mockTicketId },
    };
    mockTransaction.mockResolvedValue(mockDbResult);

    const result = await TicketService.holdTicket(mockUserId);

    expect(mockHoldTicketAtomic).toHaveBeenCalledWith(
      REDIS_KEYS.AVAILABLE_TICKETS,
      mockUserId,
      "300",
      REDIS_KEYS.HOLD_PREFIX,
    );
    expect(mockTransaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockDbResult);
  });

  it("Trường hợp 2: Báo lỗi khi Redis hết vé (status = 0)", async () => {
    // Giả lập Redis báo hết vé
    mockHoldTicketAtomic.mockResolvedValue([0, null]);

    await expect(TicketService.holdTicket(mockUserId)).rejects.toThrow(
      "Hết vé hoặc hệ thống đang bận, vui lòng thử lại!",
    );

    // Đảm bảo không gọi xuống DB nếu RAM đã báo hết vé
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("Trường hợp 3: Rollback Redis (nhả vé) nếu Database lưu thất bại", async () => {
    mockHoldTicketAtomic.mockResolvedValue([1, mockTicketId]);

    // Giả lập DB bị lỗi (rớt mạng, crash...)
    mockTransaction.mockRejectedValue(new Error("DB Connection Lost"));

    await expect(TicketService.holdTicket(mockUserId)).rejects.toThrow(
      "Có lỗi xảy ra khi tạo đơn hàng, đã hoàn tác giữ vé.",
    );

    // Kiểm tra xem cơ chế Rollback (Compensating Transaction) có được gọi không
    expect(mockDel).toHaveBeenCalledWith(
      `${REDIS_KEYS.HOLD_PREFIX}${mockTicketId}`,
    );
    expect(mockSadd).toHaveBeenCalledWith(
      REDIS_KEYS.AVAILABLE_TICKETS,
      mockTicketId,
    );
  });
});
