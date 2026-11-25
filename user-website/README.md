# NP Food — Website cửa hàng

Website bán hàng React kết nối Firebase Realtime Database, dùng chung dữ liệu với `admin-panel`.

## Chạy tại máy

```bash
npm install
npm start
```

Mở [http://localhost:3000](http://localhost:3000).

## Luồng mua hàng

- Website hiển thị banner, danh mục có sản phẩm và sản phẩm đang hoạt động từ Firebase.
- Giỏ hàng được lưu trên trình duyệt; trang thanh toán kiểm tra lại tình trạng và giá sản phẩm trước khi gửi đơn.
- Đơn mới được lưu vào nhánh `orders` với trạng thái `pending` và phương thức thanh toán khi nhận hàng.
- Quản trị viên xem và cập nhật trạng thái đơn trong admin panel.
- Form liên hệ gửi tin nhắn vào nhánh `contactMessages`.

Sản phẩm và danh mục được quản lý từ admin panel. Website chỉ hiển thị danh mục đang được sản phẩm sử dụng, tránh lộ các danh mục cũ không liên quan.
