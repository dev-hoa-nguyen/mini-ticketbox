# 🎟️ Mini Ticketbox - High Concurrency Backend System

Hệ thống Backend cung cấp API cho ứng dụng đặt vé Concert giới hạn 500 vé. Hệ thống được thiết kế đặc biệt để xử lý lượng truy cập đột biến (Spike Traffic) lên tới 5.000 users/giây, đảm bảo tuyệt đối không xảy ra tình trạng bán vượt số lượng (Over-selling) và giữ tính toàn vẹn của dữ liệu.

**Người thực hiện:** [Điền Họ Tên của bạn]
**Ngày hoàn thành:** 01/07/2026 (Trước deadline 03/07/2026)

---

## 🛠 Tech Stack

- **Core:** Node.js, ExpressJS, TypeScript
- **Database:** PostgreSQL (Lưu trữ vĩnh viễn, Transaction an toàn)
- **ORM:** Prisma
- **Cache & Concurrency:** Redis (ioredis)
- **Validation:** Zod
- **Testing:** Jest (Unit Test), Artillery (Load Test)

---

## 💡 Ý đồ Kiến trúc & Giải pháp Kỹ thuật (Core Solutions)

Dự án áp dụng mô hình **Clean Architecture**, tách biệt rõ ràng giữa các tầng Router, Controller, Service và Data Access. Để giải quyết các bài toán hóc búa của đề bài, hệ thống áp dụng các chiến lược sau:

### 1. Chống Race Condition & Over-selling (Luồng giành vé)

Thay vì sử dụng Lock trên Database (Pessimistic/Optimistic) vốn dễ gây cạn kiệt Connection Pool và làm chậm toàn bộ hệ thống dưới tải cao, hệ thống sử dụng cơ chế **Allocate-in-RAM**:

- Toàn bộ 500 ID vé được nạp lên Redis Set (`tickets:available`).
- Khi user đặt vé, Backend thực thi một đoạn **Lua Script** trên Redis để lấy (`SPOP`) và cấp phát vé. Vì Redis chạy đơn luồng (single-threaded) và Lua Script là Đơn nguyên (Atomic), 2 request đến cùng một mili-giây không bao giờ nhận được cùng 1 vé. Tốc độ xử lý đạt mức micro-giây mà không cần chạm vào DB.

### 2. Xử lý giữ vé 5 phút & Fallback (Hold Ticket)

- Áp dụng mô hình **Write-Fast-in-Memory, Persist-to-Disk**. Hệ thống khóa vé trên RAM trước, sau đó mới mở Transaction ghi xuống DB.
- **Compensating Transaction:** Trong trường hợp DB sập hoặc lỗi mạng đột xuất không thể lưu đơn hàng, hệ thống bắt Catch và lập tức Rollback (trả lại ID vé vào Set trên Redis) để tránh tình trạng mất vé oan uổng.

### 3. Tự động Nhả vé sau 5 phút (Auto-Release)

- Tránh dùng `setTimeout` của Node.js (bị mất khi restart) hoặc Cronjob quét DB (tốn CPU). Hệ thống bật **Redis Keyspace Notifications** (Pub/Sub).
- Khi Key giữ vé trên Redis hết hạn (TTL = 0), Redis phát ra sự kiện. Một Background Worker lắng nghe sự kiện này và tự động cập nhật PostgreSQL để nhả vé.
- _Trade-off:_ Pub/Sub của Redis là Fire-and-Forget. Ở môi trường Production thực tế, tôi sẽ bổ sung một Cronjob dự phòng chạy 10 phút/lần để quét dọn các vé bị kẹt nếu Worker Node.js bị rớt mạng đúng khoảnh khắc event phát ra.

### 4. Giao tiếp Real-time với Client (SSE)

- Dùng **Server-Sent Events (SSE)** thay vì WebSockets để truyền tải số lượng vé còn lại. Vì luồng dữ liệu chỉ đi một chiều (Server -> Client) và yêu cầu cực kỳ nhẹ, SSE giúp tiết kiệm tài nguyên Server đáng kể.
- Dữ liệu SSE được broadcast ngầm mỗi 2 giây bằng cách đếm số phần tử trong Redis Set (`SCARD`), không tạo gánh nặng lên DB.

---

## 📂 Cấu trúc Thư mục

```text
src/
 ├── api/           # Khai báo Routes và Controllers
 ├── core/          # Global Error Handler, Middlewares, Utils
 ├── db/            # Khởi tạo kết nối Prisma, Redis, cấu hình Keyspace
 ├── dto/           # Zod Schema validate request payload
 ├── services/      # Business Logic (Nghiệp vụ cốt lõi, Lua scripts, Workers)
 ├── types/         # Types/Interfaces
 ├── app.ts         # Setup Express App
 └── server.ts      # Entry point
```

## 🚀 Hướng dẫn Cài đặt & Khởi chạy (Local)

### Bước 1: Khởi động Hạ tầng (DB & Redis)

```bash
docker-compose up -d
```

### Bước 2: Cài đặt thư viện

```bash
pnpm install
```

### Bước 3: Cấu hình biến môi trường

```.env
PORT=8080
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketbox?schema=public"
REDIS_URL="redis://localhost:6379"
```

### Bước 4: Migrate Database & Seed Dữ liệu

```bash
npx prisma db push
npx prisma db seed
```

### Bước 5: Khởi động Server

```bash
pnpm dev
```

Hệ thống sẽ chạy tại `http://localhost:8080`. Chú ý terminal log để thấy quá trình nạp vé lên Redis và Worker bắt đầu lắng nghe.

## 🧪 Testing

### 2. Unit Test (Jest)

Kiểm tra logic cốt lõi của hàm `holdTicket`, bao gồm test Rollback khi DB lỗi.

```bash
pnpm test
```

### 2. Load Test (Artillery)

Kịch bản mô phỏng 5.000 users liên tục gửi request đặt vé vào hệ thống trong vòng 10 giây.
Cách chạy:

1. Đảm bảo server đang chạy và DB đã được seed đầy đủ 500 vé.

2. Mở terminal mới chạy lệnh:

```bash
npx artillery run load-test.yml -o report.json
```

Kết quả kỳ vọng: Dù có 5.000 request được gửi đi, sẽ chỉ có đúng 500 request trả về HTTP 200 (Thành công), 4.500 request còn lại sẽ bị Redis chặn lại và trả về HTTP 400 (Hết vé). Hệ thống PostgreSQL không hề bị quá tải.

(Lưu ý: Hãy chụp ảnh biểu đồ kết quả load test và chèn vào đây trước khi nộp bài)
