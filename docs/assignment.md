# 📋 ĐỀ BÀI: THIẾT KẾ HỆ THỐNG ĐẶT VÉ CONCERT (MINI TICKETBOX)

## 1. Bối cảnh (Scenario)

Hệ thống chuẩn bị mở bán vé cho một Concert ca nhạc giới hạn 500 vé. Dự kiến khi cổng mở, sẽ có khoảng 5.000 người dùng cùng vào giành giật, F5 liên tục và bấm đặt vé cùng một thời điểm. Bạn hãy xây dựng một ứng dụng Fullstack (gồm Backend API + Frontend Web) để giải quyết bài toán này.
Bạn được tự do lựa chọn Tech Stack (Ngôn ngữ, Framework, Database) mà bạn tự tin nhất.

## 2. Yêu Cầu Tính Năng (Scope of Work)

### Phía Backend (API):

- **Quản lý kho vé:** Định nghĩa cấu trúc dữ liệu cho Vé (Loại vé, Giá vé, Số lượng tồn kho, Trạng thái: Trống / Đang giữ / Đã bán).
- **Luồng Giữ Vé (Hold & Reserve):** Khi User bấm "Chọn vé", hệ thống sẽ giữ vé đó trong 5 phút để họ điền thông tin và thanh toán. Trong 5 phút này, người khác không thể chọn vé đó. Sau 5 phút nếu không thanh toán, vé tự động được nhả ra (Release) lại vào kho.
- **Thanh Toán Giả Lập:** Tạo API nhận yêu cầu thanh toán thành công -> chuyển trạng thái vé thành Đã bán.

### Phía Frontend (UI/UX):

- **Trang chủ Sự kiện:** Hiển thị số lượng vé còn lại theo thời gian thực (Real-time).
- **Trang Đặt vé:** Có màn hình chọn loại vé, hiển thị đồng hồ đếm ngược (Countdown) 5 phút giữ vé.
- **Trang Admin:** Một dashboard đơn giản xem thống kê số lượng vé đã bán, doanh thu và danh sách vé đang bị khóa tạm thời.

## 🎯 CÁC ĐIỂM TEAM KỸ THUẬT SẼ TẬP TRUNG ĐÁNH GIÁ

Khi chấm bài, chúng tôi sẽ đặc biệt chú ý đến cách bạn giải quyết 3 bài toán sau:

- **Xử lý Concurrency (Backend):** Giải pháp chống Over-selling (Bán quá số lượng vé) khi có hàng ngàn request cùng đổ vào một mili-giây (Chặn Race Condition).
- **Trải nghiệm người dùng dưới tải cao (Frontend UX):** Cách giao diện xử lý khi mạng lag hoặc server phản hồi chậm (Chặn spam click, trạng thái loading, đồng bộ đồng hồ đếm ngược...).
- **Chất lượng mã nguồn (Clean Code):** Cách tổ chức thư mục, xử lý lỗi tập trung (Global Error Handling), Data Validation ở cửa ngõ API, và viết Unit Test cho các logic cốt lõi.

**Note:** Chúng tôi không chấm điểm dựa trên việc bạn làm ứng dụng to hay nhỏ, mà tập trung vào cách bạn xử lý các góc khuất của ứng dụng (Edge cases), cách bạn viết mã nguồn sạch và tư duy giải quyết bài toán chịu tải. Hãy làm nó như một sản phẩm bạn thực sự muốn đem đi bán cho khách hàng.

### 📬 Nộp bài:

- **Hạn chót nộp bài (Deadline):** Trước 23:59, Ngày 3/7/2026.
- **Tài liệu đính kèm:** File `README.md` trong repo cần ghi rõ Họ tên của bạn, hướng dẫn cách chạy project ở local (khuyến khích dùng Docker) và giải thích ngắn gọn về ý đồ kiến trúc cũng như các giải pháp kỹ thuật bạn đã chọn.
