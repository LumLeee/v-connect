# Admin đăng nhập bằng username

Admin dùng username và mật khẩu, email không bắt buộc. Volunteer và Organizer tiếp tục dùng email. Form đăng ký công khai không được cấp vai trò Admin hoặc đặt username.

Tạo Admin bằng `python backend/manage.py createsuperuser --username admin`; đổi mật khẩu bằng `python backend/manage.py changepassword admin`. Không có mật khẩu mặc định. Admin đăng nhập được trên website và Django Admin; không dùng luồng quên mật khẩu bằng email.

Migration `accounts.0003_user_username_alter_user_email_and_more` phụ thuộc trực tiếp `0001_initial`, độc lập với hồ sơ giai đoạn 3. Tài khoản Admin cũ được cấp username `admin_` cộng UUID không dấu gạch; giữ nguyên mật khẩu, email và quyền. Có thể đổi username trong Django Admin sau khi xác minh tài khoản. Không tự đổi mọi tài khoản cũ thành `admin`.

Giữ tên migration đã áp dụng tại local để tránh chạy lại thao tác thêm cột. Khi đưa hồ sơ giai đoạn 3 vào, migration hồ sơ phụ thuộc migration xác thực này; Django xác định thứ tự theo dependency, không theo số trong tên file.

Kiểm thử bao gồm đăng nhập username, email tùy chọn, chống tự cấp quyền, lệnh tạo/đổi mật khẩu Admin và bảo toàn dữ liệu tài khoản cũ khi migration.
