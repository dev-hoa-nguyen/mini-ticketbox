-- Cho phép 1 Order chứa NHIỀU vé (giỏ vé nhiều loại): bỏ ràng buộc UNIQUE trên orderId.
-- DropIndex
DROP INDEX "tickets_orderId_key";

-- CreateIndex (index thường để truy vấn vé theo Order nhanh)
CREATE INDEX "tickets_orderId_idx" ON "tickets"("orderId");
