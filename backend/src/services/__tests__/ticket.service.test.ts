import { jest } from "@jest/globals";

// ESM: jest.mock KHÔNG được hoist như CommonJS.
// Phải dùng unstable_mockModule + dynamic import() sau khi mock.
const mockHoldCartAtomic = jest.fn();
const mockUpsert = jest.fn();
const mockTransaction = jest.fn();

const mockPipelineSadd = jest.fn();
const mockPipelineDel = jest.fn();
const mockPipelineExec = jest.fn();
const mockPipeline = jest.fn(() => ({
  sadd: mockPipelineSadd,
  del: mockPipelineDel,
  exec: mockPipelineExec,
}));

const REDIS_KEYS = {
  HOLD_PREFIX: "ticket:hold:",
  TYPES_SET: "tickets:types",
  availableByType: (type: string) => `tickets:available:${type}`,
};

jest.unstable_mockModule("@/database/redis", () => ({
  redis: {
    holdCartAtomic: mockHoldCartAtomic,
    defineCommand: jest.fn(), // ticket.service gọi lúc load module
    pipeline: mockPipeline,
  },
  REDIS_KEYS,
  getAvailabilityByType: jest.fn(),
}));

jest.unstable_mockModule("@/database/prisma", () => ({
  prisma: {
    user: { upsert: mockUpsert },
    $transaction: mockTransaction,
  },
}));

const { TicketService } = await import("../ticket.service");

describe("TicketService.holdCart", () => {
  const email = "buyer@example.com";
  const userId = "user-uuid-1";
  const typeA = "TIER S - ZONE A";

  beforeEach(() => {
    mockUpsert.mockResolvedValue({ id: userId, email, name: "buyer" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Giữ giỏ vé thành công: gọi Lua đúng tham số & trả data từ DB", async () => {
    mockHoldCartAtomic.mockResolvedValue([1, ["t1", "t2"]]);
    const dbResult = {
      order: { id: "order-1" },
      tickets: [{ id: "t1" }, { id: "t2" }],
    };
    mockTransaction.mockResolvedValue(dbResult);

    const result = await TicketService.holdCart({
      email,
      items: [{ type: typeA, quantity: 2 }],
    });

    // numKeys, ...keys, userId, ttl, holdPrefix, ...quantities
    expect(mockHoldCartAtomic).toHaveBeenCalledWith(
      1,
      REDIS_KEYS.availableByType(typeA),
      userId,
      "300",
      REDIS_KEYS.HOLD_PREFIX,
      "2",
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(dbResult);
  });

  it("All-or-nothing: 1 loại không đủ -> ném lỗi 409, KHÔNG ghi DB", async () => {
    // status=0, index=1 (loại đầu), còn 3 vé
    mockHoldCartAtomic.mockResolvedValue([0, 1, 3]);

    await expect(
      TicketService.holdCart({
        email,
        items: [{ type: typeA, quantity: 5 }],
      }),
    ).rejects.toThrow(`Loại vé "${typeA}" chỉ còn 3 vé`);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("Rollback Redis (trả vé về đúng loại) nếu ghi DB thất bại", async () => {
    mockHoldCartAtomic.mockResolvedValue([1, ["t1", "t2"]]);
    mockTransaction.mockRejectedValue(new Error("DB Connection Lost"));

    await expect(
      TicketService.holdCart({
        email,
        items: [{ type: typeA, quantity: 2 }],
      }),
    ).rejects.toThrow("đã hoàn tác giữ vé");

    // Trả 2 vé về set theo loại + xoá 2 hold key
    expect(mockPipelineSadd).toHaveBeenCalledWith(
      REDIS_KEYS.availableByType(typeA),
      "t1",
      "t2",
    );
    expect(mockPipelineDel).toHaveBeenCalledWith(`${REDIS_KEYS.HOLD_PREFIX}t1`);
    expect(mockPipelineDel).toHaveBeenCalledWith(`${REDIS_KEYS.HOLD_PREFIX}t2`);
    expect(mockPipelineExec).toHaveBeenCalled();
  });

  it("Chặn mua quá giới hạn mỗi đơn (tổng > 10 vé)", async () => {
    await expect(
      TicketService.holdCart({
        email,
        items: [{ type: typeA, quantity: 11 }],
      }),
    ).rejects.toThrow("tối đa 10 vé");

    expect(mockHoldCartAtomic).not.toHaveBeenCalled();
  });
});
