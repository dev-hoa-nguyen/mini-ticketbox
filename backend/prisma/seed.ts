import { prisma } from "src/database/prisma";
import { TicketStatus } from "../generated/client";

async function main() {
  // Idempotent: nếu đã có vé (VD chạy lại `docker compose up`), bỏ qua để không
  // xoá dữ liệu đang chạy. Muốn seed lại từ đầu: xoá volume DB rồi chạy lại.
  const existing = await prisma.ticket.count();
  if (existing > 0) {
    console.log(`✅ DB đã có ${existing} vé, bỏ qua seed.`);
    return;
  }

  console.log("Bắt đầu quá trình dọn dẹp và seed dữ liệu...");

  // 1. Dọn dẹp dữ liệu cũ (Xóa theo thứ tự để tránh lỗi khóa ngoại)
  await prisma.order.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Đã xóa toàn bộ dữ liệu cũ.");

  // 2. Chuẩn bị mảng 500 vé
  const TOTAL_TICKETS = 500;
  const TICKET_PRICE = 750000;

  // Tạo mảng data chứa 500 object vé
  const ticketsData = Array.from({ length: TOTAL_TICKETS }).map((_, idx) => {
    const ticketNumber = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    const ticketType = idx % 2 === 0 ? "TIER S - ZONE A" : "TIER A - ZONE B";
    const ticketPrice = idx % 2 === 0 ? TICKET_PRICE * 2 : TICKET_PRICE;

    return {
      code: `TICKET-${ticketNumber}`,
      price: ticketPrice,
      status: TicketStatus.AVAILABLE, // Mặc định là vé trống
      type: ticketType,
      version: 0,
    };
  });

  console.log(`Đang tiến hành insert ${TOTAL_TICKETS} vé vào database...`);

  // 3. Thực thi bulk insert bằng createMany
  const insertResult = await prisma.ticket.createMany({
    data: ticketsData,
    skipDuplicates: true, // Bỏ qua nếu lỡ trùng code
  });

  console.log(`✅ Seed thành công: Đã tạo ${insertResult.count} vé vào kho.`);

  // 4. (Tùy chọn) Tạo thêm 1 User mẫu để test luồng Checkout sau này
  const testUser = await prisma.user.create({
    data: {
      email: "testuser@ticketbox.mini",
      name: "User",
    },
  });

  console.log(`✅ Đã tạo User mẫu: ${testUser.email}`);
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra trong quá trình seed dữ liệu:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Luôn ngắt kết nối an toàn sau khi hoàn thành
    await prisma.$disconnect();
    console.log("Đã đóng kết nối Database.");
  });
