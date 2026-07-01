-- Giữ NHIỀU vé thuộc NHIỀU loại cùng lúc, ATOMIC & ALL-OR-NOTHING.
-- KEYS[1..n]     : Set vé trống của từng loại (VD: "tickets:available:TIER S - ZONE A")
-- ARGV[1]        : userId (ghi vào hold key)
-- ARGV[2]        : ttl (giây) cho mỗi hold key
-- ARGV[3]        : prefix hold key (VD: "ticket:hold:")
-- ARGV[3 + i]    : số lượng cần giữ tương ứng KEYS[i]
--
-- Trả về:
--   { 1, {ticketIds...} }        khi thành công (ids theo đúng thứ tự KEYS/quantities)
--   { 0, i, availableNow }       khi KEYS[i] không đủ vé (đã rollback toàn bộ)

local userId = ARGV[1]
local ttl = ARGV[2]
local holdPrefix = ARGV[3]

local poppedKeys = {}
local poppedVals = {}
local allIds = {}

for i = 1, #KEYS do
  local qty = tonumber(ARGV[3 + i])
  local got = redis.call('SPOP', KEYS[i], qty)

  if (not got) or (#got < qty) then
    -- Thiếu vé -> hoàn trả những gì vừa lấy ở key này...
    if got and #got > 0 then
      redis.call('SADD', KEYS[i], unpack(got))
    end
    -- ...và hoàn trả toàn bộ các key trước đó (all-or-nothing)
    for j = 1, #poppedKeys do
      redis.call('SADD', poppedKeys[j], unpack(poppedVals[j]))
    end
    local availableNow = 0
    if got then availableNow = #got end
    return { 0, i, availableNow }
  end

  poppedKeys[#poppedKeys + 1] = KEYS[i]
  poppedVals[#poppedVals + 1] = got
  for k = 1, #got do
    allIds[#allIds + 1] = got[k]
  end
end

-- Thành công: gắn hold key TTL cho từng vé (cùng 1 lượt thực thi atomic)
for i = 1, #allIds do
  redis.call('SETEX', holdPrefix .. allIds[i], ttl, userId)
end

return { 1, allIds }
