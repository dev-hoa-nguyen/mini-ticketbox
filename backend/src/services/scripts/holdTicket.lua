-- KEYS[1]: Key chứa Set vé trống của MỘT loại vé (VD: "tickets:available:TIER S - ZONE A")
-- ARGV[1]: userId (ID của người dùng đang đặt vé)
-- ARGV[2]: ttl (Thời gian giữ vé tính bằng giây, VD: "300")
-- ARGV[3]: Prefix của hold key (VD: "ticket:hold:")

-- 1. Sử dụng lệnh SPOP để lấy ra và xóa lập tức 1 ticketId khỏi Set vé trống.
-- Lệnh SPOP mang tính Atomic tuyệt đối: 2 request không bao giờ SPOP ra cùng 1 ticketId!
local ticketId = redis.call('SPOP', KEYS[1])

-- Nếu Set rỗng (bằng false hoặc nil), tức là đã hết vé trống
if not ticketId then
    return { 0, "SOLD_OUT" }
end

-- 2. Nếu lấy được vé, tạo Key giữ vé với thời gian sống (TTL) là 5 phút
local holdKey = ARGV[3] .. ticketId
redis.call('SETEX', holdKey, ARGV[2], ARGV[1])

-- 3. Trả về status thành công (1) kèm theo ID của vé vừa giữ được
return { 1, ticketId }
