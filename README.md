# 🎟️ Mini Ticketbox — Hệ thống đặt vé Concert chịu tải cao

> **Tác giả:** _Nguyễn Thanh Hòa_
> Bài test Fullstack — xây dựng hệ thống bán vé giới hạn **500 vé** cho sự kiện có
> thể lên tới **~5.000 người dùng đồng thời** tranh vé, F5 liên tục. Trọng tâm:
> **chống bán quá số lượng (over-selling)** ở backend và **trải nghiệm mượt dưới
> tải cao** ở frontend.

---

## 1. Tổng quan bài toán

Khi cổng mở bán, hàng nghìn request đổ vào cùng một mili-giây để giành 500 vé.
Thách thức cốt lõi:

1. **Race condition / Over-selling** — hai người không bao giờ được giữ trùng một vé.
2. **Giữ vé 5 phút** rồi tự động nhả nếu không thanh toán — không dùng `setTimeout`.
3. **UX dưới tải cao** — chống spam click, đồng bộ đồng hồ đếm ngược, số vé real-time.

## 2. Tech Stack

| Lớp          | Công nghệ                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Backend**  | Node.js, Express, TypeScript (strict), Prisma ORM, PostgreSQL, Redis (ioredis), Zod, Jest                                |
| **Frontend** | React 19, TanStack Start (SSR) + Router + Query, TailwindCSS v4, shadcn-style UI, lucide-react, Vitest + Testing Library |
| **Hạ tầng**  | Docker Compose (PostgreSQL 15 + Redis 7)                                                                                 |

## 3. Kiến trúc dự án

### 3.1. Chống Over-selling — Redis Lua Script (Atomic)

Trái tim của hệ thống. **Không** dùng logic “đọc rồi ghi” (`SELECT count → trừ → UPDATE`)
vì sẽ dính race condition. Thay vào đó:

- Mỗi **loại vé** có một Redis Set riêng: `tickets:available:<type>` chứa ID các vé còn trống.
- Việc trừ kho chạy trong **một Lua script atomic** (`holdCart.lua`). Redis đơn luồng
  ⇒ script chạy trọn vẹn, không request nào chen ngang:
  - `SPOP` lấy đúng số lượng vé cần cho từng loại. `SPOP` bảo đảm 2 request **không bao giờ**
    lấy trùng một ID.
  - Nếu **bất kỳ loại nào không đủ** ⇒ **rollback toàn bộ** (`SADD` trả lại các vé đã lấy)
    và trả về lỗi ⇒ giỏ hàng **all-or-nothing**, không giữ nửa vời.
  - Nếu đủ ⇒ đặt `SETEX ticket:hold:<id>` TTL 300s cho từng vé (khoá 5 phút) — cùng trong
    một lượt atomic với thao tác trừ kho.
- PostgreSQL là **nguồn chân lý bền vững**: sau khi RAM khoá thành công mới ghi Order + Ticket
  trong transaction. Nếu ghi DB lỗi ⇒ **hoàn tác bù (compensating)**: trả vé về Redis Set.

### 3.2. Tự động nhả vé sau 5 phút — Redis Keyspace Notifications

- Bật `notify-keyspace-events Ex` (thực hiện lúc khởi động, trong `setupRedisKeyspaceNotifications`).
- `ReleaseTicketWorker` subscribe kênh `__keyevent@0__:expired`. Khi hold key `ticket:hold:<id>`
  hết hạn, Redis bắn event ⇒ worker **hết hạn cả đơn** (giỏ vé) và **nhả toàn bộ vé của đơn đó**
  về đúng Set theo loại, dọn các hold key anh em.
- Cơ chế này thay cho `setTimeout` (không sống sót qua restart, không scale) → dựa vào Redis, tin cậy.

### 3.3. Real-time số vé còn lại — Server-Sent Events (SSE)

- `GET /tickets/stream` phát định kỳ 2s: `{ availableCount, byType }` (đếm `SCARD` từng Set — O(1)).
- Frontend `useTicketStream` tự **reconnect với exponential backoff** khi rớt kết nối / server 503.

### 3.4. Clean Code & chuẩn hoá

- **Response chuẩn** mọi endpoint: `{ success, data, error, message }`.
- **Global Error Handler** tập trung; service ném `AppError(message, statusCode)`; controller bọc `catchAsync`
  ⇒ không rải rác try/catch.
- **Validate tại cửa ngõ** bằng Zod cho toàn bộ body/params.
- Chỉ `SELECT` trường cần thiết; luôn dùng Prisma parameterized (chống SQL injection).

### 3.5. Sơ đồ luồng giữ vé

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant FE as Frontend
    participant API as Express API
    participant R as Redis (Lua atomic)
    participant DB as PostgreSQL
    participant W as Release Worker

    U->>FE: Chọn giỏ vé + nhập email → "Đặt vé"
    FE->>API: POST /tickets/hold { email, items[] }
    API->>API: Zod validate + chặn > 10 vé/đơn
    API->>DB: upsert User theo email
    API->>R: holdCartAtomic(SPOP theo từng loại)

    alt Có loại không đủ vé
        R->>R: SADD trả lại toàn bộ (all-or-nothing)
        R-->>API: { 0, index, available }
        API-->>FE: 409 — "Loại vé X chỉ còn N vé"
        FE-->>U: Toast đỏ, không giữ vé nào
    else Đủ vé
        R->>R: SETEX ticket:hold:<id> TTL 300s (khoá 5 phút)
        R-->>API: { 1, ticketIds[] }
        API->>DB: Transaction — tạo Order + set vé HOLD
        alt Ghi DB lỗi
            API->>R: Rollback bù — SADD trả vé + DEL hold keys
            API-->>FE: 500 — "đã hoàn tác giữ vé"
        else Thành công
            DB-->>API: order + tickets (expiresAt)
            API-->>FE: 200 { order, tickets }
            FE->>FE: Lưu localStorage + đếm ngược 5 phút
        end
    end

    Note over FE,W: Trong vòng 5 phút

    alt Thanh toán kịp
        U->>FE: "Xác nhận thanh toán"
        FE->>API: POST /tickets/pay { orderId }
        API->>DB: Order COMPLETED, vé → SOLD
        API->>R: DEL toàn bộ hold key (không cho expired bắn)
        API-->>FE: 200 — Thành công
    else Quá 5 phút
        R-->>W: Keyspace event "expired" (ticket:hold:<id>)
        W->>DB: Order EXPIRED, nhả TOÀN BỘ vé của đơn → AVAILABLE
        W->>R: SADD vé về Set theo loại (kho hồi lại)
    end
```

**Vòng đời trạng thái vé:**

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Seed / khởi tạo
    AVAILABLE --> HOLD: Giữ vé (Lua SPOP + SETEX)
    HOLD --> SOLD: Thanh toán trong 5 phút
    HOLD --> AVAILABLE: Hết hạn (worker nhả) / rollback DB
    SOLD --> [*]
```

## 4. Cấu trúc thư mục

```text
mini-ticketbox/
├── docker-compose.yaml        # 4 service: postgres, redis, backend, frontend
├── .env.example               # cấu hình dùng chung (copy → .env)
├── backend/
│   ├── Dockerfile             # build + entrypoint tự migrate & seed
│   ├── prisma/                # schema (multi-file), migrations, seed
│   └── src/
│       ├── api/               # routers + controllers
│       ├── core/              # errors (AppError), utils (catchAsync)
│       ├── database/          # prisma, redis (keys + sync + keyspace)
│       ├── dto/               # Zod schemas
│       └── services/          # nghiệp vụ + scripts/*.lua + workers/
└── frontend/
    └── src/
        ├── features/          # tickets, checkout, admin (api/hooks/ui)
        ├── components/        # UI dùng chung
        ├── routes/            # TanStack file-based routing
        └── lib/               # api-client, query-client, format…
```

## 5. Tính năng

- **Trang chủ**: hero sự kiện + số vé còn lại real-time (SSE).
- **Quầy đặt vé** (layout kiểu POS): danh sách loại vé bên trái, giỏ vé (cuống vé) bên phải.
  Mua **nhiều loại/nhiều số lượng cùng lúc** (tối đa 10 vé/đơn), **xác minh bằng email**.
- **Giữ vé & thanh toán**: đồng hồ đếm ngược 5 phút, khôi phục phiên khi F5, thanh toán giả lập.
- **Trang Admin**: thống kê vé (trống/đang giữ/đã bán), doanh thu, và **bóc tách theo từng loại vé**;
  tự làm mới mỗi 3s.

## 6. Chạy dự án — chỉ **một lệnh** với Docker

Yêu cầu duy nhất: **Docker** (kèm Docker Compose v2).

```bash
docker compose up --build
```

Lệnh này tự động dựng **toàn bộ**:

1. **PostgreSQL** + **Redis** (chờ tới khi `healthy`).
2. **Backend**: build image → **chạy migrations** → **seed 500 vé** (idempotent,
   bỏ qua nếu đã có dữ liệu) → khởi động API.
3. **Frontend**: build image → phục vụ giao diện.

Sau khi các container báo `healthy`, mở:

| Dịch vụ         | URL                          |
| --------------- | ---------------------------- |
| 🖥️ Frontend     | **http://localhost:3000**    |
| ⚙️ Backend API  | http://localhost:8080/api    |
| 🩺 Health check | http://localhost:8080/health |

Dừng: `docker compose down` · Xoá sạch cả dữ liệu (seed lại từ đầu): `docker compose down -v`.

### Biến môi trường (tuỳ chọn)

Compose đã có sẵn giá trị mặc định nên chạy được ngay. Muốn tuỳ chỉnh, **tạo một file
`.env` duy nhất ở thư mục gốc** (mẫu có sẵn ở `.env.example`):

```bash
cp .env.example .env
```

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ticketbox
# Backend
NODE_ENV=production
JWT_SECRET=super-secret-change-me
# Frontend (URL trình duyệt gọi tới backend)
VITE_API_URL=http://localhost:8080/api
```

> Trong mạng Docker, backend tự nối tới `postgres:5432` và `redis:6379`
> (compose tự dựng `DATABASE_URL` / `REDIS_URL`), không cần cấu hình thêm.

### Chạy thủ công không dùng Docker (tuỳ chọn)

<details>
<summary>Bung để xem</summary>

```bash
# Hạ tầng
docker compose up -d postgres redis
# Backend (cổng 8080) — dùng DATABASE_URL/REDIS_URL trỏ localhost
cd backend && pnpm install && pnpm db:deploy && pnpm exec prisma db seed && pnpm dev
# Frontend (cổng 3000)
cd frontend && pnpm install && pnpm dev
```

</details>

## 7. API

| Method | Endpoint              | Mô tả                                                                |
| ------ | --------------------- | -------------------------------------------------------------------- |
| `GET`  | `/api/tickets/types`  | Danh sách loại vé (giá, tổng, số còn trống real-time)                |
| `POST` | `/api/tickets/hold`   | Giữ giỏ vé `{ email, items: [{ type, quantity }] }` (all-or-nothing) |
| `POST` | `/api/tickets/pay`    | Thanh toán giả lập `{ orderId }` → chuyển vé sang SOLD               |
| `GET`  | `/api/tickets/stream` | SSE số vé còn lại real-time (tổng + theo loại)                       |
| `GET`  | `/api/admin/stats`    | Thống kê vé, doanh thu, bóc tách theo loại                           |

## 8. Xử lý Edge Case (Frontend)

- **Chống spam click**: nút hành động dùng `useMutation` + `isPending` ⇒ disable + spinner ngay
  lần bấm đầu.
- **Đồng bộ đồng hồ**: `useCountdown` tính lại `expiresAt(server) − now` mỗi tick — **không** khởi tạo
  bằng `Date.now() + 5m` ⇒ không lệch khi chỉnh giờ máy / tab bị throttle.
- **Giữ phiên khi F5**: lưu hold vào `localStorage`; khi tải lại, nếu còn hạn ⇒ vào thẳng bước thanh toán
  (dùng layout effect để không “nháy” bước chọn vé). Hết hạn ⇒ dọn `localStorage`, hiện “Order Expired”.
- **Chịu lỗi**: bắt lỗi 400/409/503/mất mạng ⇒ toast đỏ với thông điệp rõ ràng; SSE tự reconnect.

## 9. Kiểm thử (Unit Test)

```bash
cd backend  && npm test        # Jest — logic giữ vé: thành công, all-or-nothing, rollback, giới hạn/đơn
cd frontend && npx vitest run  # Vitest — khôi phục phiên giữ vé sau F5 / đổi trang
```

## 10. Ghi chú kỹ thuật

- Hạn giữ vé: **300 giây**. Giới hạn: **10 vé/đơn**. Seed mặc định: **500 vé, 2 loại**
  (TIER S · ZONE A — 1.500.000đ; TIER A · ZONE B — 750.000đ).
- `docker-compose.yaml` dựng đủ **4 service**; backend có entrypoint tự chạy migrate + seed
  (idempotent) rồi mới khởi động — reviewer chỉ cần `docker compose up`.
- Keyspace notification được bật bằng code lúc khởi động backend nên **không cần** cấu hình thêm trên Redis.
- Backend khi khởi động luôn **đồng bộ lại các Set vé trống** từ DB lên Redis, nên restart là an toàn.
- Frontend chạy ở chế độ dev-server (Vite) trong container để phục vụ ổn định cả SSR lẫn client.
