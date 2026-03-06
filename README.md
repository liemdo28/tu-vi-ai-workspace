# Bát Tự - Tử Vi AI Workspace (v2)

Ứng dụng 1 trang có:
- Quản lý hồ sơ `\Nhân Mệnh\` theo từng người.
- Phân tích Bát tự/Tử vi theo ngày sinh + **giờ sinh Can Chi** (Tý, Sửu, Dần...).
- Hỏi đáp theo từng hồ sơ với AI + Web Search + báo cáo chi tiết.
- Bảng thống kê định lượng (cân bằng ngũ hành, độ vững nhật chủ, điểm ổn định...).
- Lịch đề xuất + nút thêm Google Calendar.
- v2: Đăng nhập + đồng bộ hồ sơ qua DB (dùng nhiều thiết bị).

## Stack
- Cloudflare Pages + Functions
- Frontend: HTML/CSS/JS
- AI: OpenAI Responses API
- Search: SerpAPI + Wikipedia fallback
- DB: Cloudflare D1

## Chạy local
```bash
npm install
copy .dev.vars.example .dev.vars
npm run dev
```

## Biến môi trường
Trong `.dev.vars`:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SERPAPI_API_KEY=
AUTH_SECRET=doi-thanh-secret-rat-dai
```

## Cấu hình DB (Cloudflare D1)
Trong Cloudflare Pages project:
1. Tạo D1 database.
2. Bind D1 vào Pages Function với tên binding: `DB`.
3. Add biến `AUTH_SECRET` ở Environment variables.

### Schema
Functions tự tạo bảng bằng `CREATE TABLE IF NOT EXISTS`.
Bạn không cần chạy migration riêng để bắt đầu.

## API chính
- `POST /api/run`:
  - `action: analyze_profile`
  - `action: ask_profile`
  - `action: calendar_plan`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST|DELETE /api/profiles`

## Deploy domain miễn phí
Deploy lên Cloudflare Pages và dùng domain dạng:
- `https://<project-name>.pages.dev`

## Lưu ý
- Bát tự/Tử vi chỉ mang tính tham khảo.
- Quyết định tài chính/sức khỏe/pháp lý cần kết hợp dữ liệu thực tế và chuyên gia.
