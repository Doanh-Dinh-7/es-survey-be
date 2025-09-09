# Hướng Dẫn Triển Khai Production Backend Server

Hướng dẫn này giúp bạn triển khai server backend cho môi trường production, sử dụng Docker Compose, Nginx, và Prisma.

## Yêu Cầu Trước Khi Triển Khai

- Đã cài đặt Docker và Docker Compose trên máy chủ production.
- Đã có domain hoặc IP trỏ về server (nếu cần truy cập từ xa).
- Đã cấu hình các biến môi trường cần thiết (xem trong `docker-compose.yml`).

## Bước 1: Chuẩn Bị Source Code & Cấu Hình

1. Đảm bảo source code backend đã được build sẵn (nếu không, Dockerfile sẽ tự động build).
2. Kiểm tra file `nginx.conf` đã đúng cấu hình reverse proxy cho frontend và backend.
3. Kiểm tra file `.env` (nếu sử dụng) hoặc cập nhật biến môi trường trong `docker-compose.yml` cho phù hợp với môi trường production (database, SMTP, Auth0, Slack, ...).
4. Lưu ý đường dẫn tới thư mục của front-end hoặc có thể thay thế bằng image nếu đã build sẵn.

## Bước 2: Khởi Tạo & Chạy Dịch Vụ Bằng Docker Compose

1. Tại thư mục `backend`, chạy lệnh sau để khởi động toàn bộ hệ thống (PostgreSQL, backend, frontend, nginx, pgadmin):

   ```bash
   docker-compose up -d
   ```

   - Các container sẽ tự động build và chạy ở chế độ nền.
   - Nginx sẽ reverse proxy các request đến frontend (port 80) và backend (port 3000).

2. Kiểm tra trạng thái các container:

   ```bash
   docker-compose ps
   ```

3. Để xem log của backend:

   ```bash
   docker-compose logs -f survey-backend
   ```

## Bước 3: Database & Prisma

- Khi container backend khởi động, script `docker-entrypoint.js` sẽ tự động:
  - Deploy các migration Prisma (`npx prisma migrate deploy`)
  - Generate Prisma client (`npx prisma generate`)
  - Seed dữ liệu mẫu (nếu có)
- Không cần thao tác thủ công với Prisma khi chạy production, trừ khi bạn muốn migrate thủ công.

## Bước 4: Truy Cập Ứng Dụng

- Ứng dụng frontend sẽ chạy trên port 80 (qua Nginx).
- API backend sẽ được reverse proxy qua Nginx tại `/api/`.
- WebSocket backend sẽ được reverse proxy qua Nginx tại `/socket.io/`.
- PostgreSQL mở port 5432 (chỉ nên mở nội bộ hoặc bảo vệ bằng firewall).
- PgAdmin truy cập qua port 5050 (nên đổi mật khẩu mặc định).

## Bước 5: Quản Lý & Bảo Mật

- Đảm bảo các biến môi trường nhạy cảm (database, SMTP, Auth0, Slack, ...) không bị lộ.
- Nên sử dụng HTTPS cho Nginx (cấu hình thêm SSL cert nếu cần).
- Định kỳ kiểm tra log và backup database.

## Một Số Lưu Ý

- Khi thay đổi schema Prisma, cần rebuild lại backend hoặc chạy lại migration.
- Nếu cần cập nhật code, chỉ cần pull code mới và chạy lại `docker-compose up -d --build`.
- Để dừng toàn bộ dịch vụ:  
  ```bash
  docker-compose down
  ```
