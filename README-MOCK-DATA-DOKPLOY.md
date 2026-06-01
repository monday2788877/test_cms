# Hướng dẫn chạy mock data CMS và Public API vào PostgreSQL trên Dokploy

Tài liệu này dùng cho bộ source Estela đang deploy bằng Dockerfile trên Dokploy.

Mô hình database khuyến nghị:

```txt
1 PostgreSQL service/container trong Dokploy
├── database estela_cms  → Payload CMS
└── database estela_api  → Public API / Prisma
```

---

## 1. Kiểm tra PostgreSQL đang chạy

Trên VPS/Dokploy server:

```bash
docker ps | grep -i postgres
```

Ví dụ container đang chạy:

```txt
tps-estelapostgres-wsq2jh.1.xxxxxxxx
```

Vào PostgreSQL:

```bash
docker exec -it <postgres_container_name> psql -U estela_user -d postgres
```

Ví dụ:

```bash
docker exec -it tps-estelapostgres-wsq2jh.1.xxxxxxxx psql -U estela_user -d postgres
```

Kiểm tra database:

```sql
\l
```

Nếu chưa có 2 database thì tạo:

```sql
CREATE DATABASE estela_cms;
CREATE DATABASE estela_api;
```

Thoát psql:

```sql
\q
```

---

## 2. Cấu hình env cho CMS

Trong Dokploy app `test-cms` hoặc `payload-cms`, set env:

```env
DATABASE_URI=postgresql://estela_user:<password_url_encoded>@tps-estelapostgres-wsq2jh:5432/estela_cms
DATABASE_URL=postgresql://estela_user:<password_url_encoded>@tps-estelapostgres-wsq2jh:5432/estela_cms
PAYLOAD_DB_PUSH=true
```

Ví dụ password thật là:

```txt
TpsP@12345
```

thì trong connection string phải encode `@` thành `%40`:

```env
DATABASE_URI=postgresql://estela_user:TpsP%4012345@tps-estelapostgres-wsq2jh:5432/estela_cms
DATABASE_URL=postgresql://estela_user:TpsP%4012345@tps-estelapostgres-wsq2jh:5432/estela_cms
```

Sau đó redeploy CMS.

---

## 3. Chạy schema cho CMS

Tìm container CMS:

```bash
docker ps | grep -Ei "cms|payload|test-cms"
```

Chạy bootstrap schema:

```bash
docker exec -it <cms_container_name> yarn bootstrap:schema
```

Nếu container không nhận trực tiếp `yarn`, vào shell:

```bash
docker exec -it <cms_container_name> sh
cd /app
yarn bootstrap:schema
```

Kiểm tra bảng CMS:

```bash
docker exec -it <postgres_container_name> psql -U estela_user -d estela_cms
```

Trong psql:

```sql
\dt public.*
```

Nên thấy các bảng kiểu:

```txt
users
media
properties
app_configs
districts
payload_migrations
payload_preferences
payload_locked_documents
```

---

## 4. Chạy mock/seed data cho CMS

Vào container CMS:

```bash
docker exec -it <cms_container_name> sh
cd /app
```

Xem script seed đang có:

```bash
cat package.json | grep -A 40 scripts
```

Chạy seed CMS:

```bash
yarn seed
```

Nếu source có seed R2/demo media:

```bash
yarn seed:r2
```

Nếu có script tổng hợp:

```bash
yarn seed:all
```

Nếu package không có script nhưng có file seed trong source, chạy trực tiếp:

```bash
yarn tsx src/seed.ts
```

hoặc:

```bash
npx tsx src/seed.ts
```

Kiểm tra dữ liệu CMS:

```bash
docker exec -it <postgres_container_name> psql -U estela_user -d estela_cms
```

Trong psql:

```sql
SELECT COUNT(*) FROM app_configs;
SELECT COUNT(*) FROM districts;
SELECT COUNT(*) FROM properties;
SELECT COUNT(*) FROM media;

SELECT id, key FROM app_configs LIMIT 10;
SELECT id, name FROM districts LIMIT 20;
SELECT id, title, status FROM properties ORDER BY id DESC LIMIT 10;
SELECT id, filename, url, "mimeType" FROM media ORDER BY id DESC LIMIT 10;
```

---

## 5. Cấu hình env cho Public API

Trong Dokploy app `public-api`, set env:

```env
DATABASE_URL=postgresql://estela_user:<password_url_encoded>@tps-estelapostgres-wsq2jh:5432/estela_api
PAYLOAD_INTERNAL_URL=https://<cms-domain>
```

Ví dụ:

```env
DATABASE_URL=postgresql://estela_user:TpsP%4012345@tps-estelapostgres-wsq2jh:5432/estela_api
PAYLOAD_INTERNAL_URL=https://cms-estela.example.com
```

Nếu Dokploy resolve được service nội bộ CMS thì có thể dùng:

```env
PAYLOAD_INTERNAL_URL=http://test-cms:3000
```

Sau đó redeploy Public API.

---

## 6. Chạy schema cho Public API / Prisma

Tìm container public-api:

```bash
docker ps | grep -i public
```

Vào container:

```bash
docker exec -it <public_api_container_name> sh
cd /app
```

Generate Prisma client:

```bash
npx prisma generate
```

Tạo bảng vào database `estela_api`:

```bash
npx prisma db push
```

Nếu source đang dùng migration production thì dùng:

```bash
npx prisma migrate deploy
npx prisma generate
```

Không chạy lệnh này trên database đang chứa CMS:

```bash
npx prisma migrate reset
```

Lệnh đó có thể reset/drop schema và làm mất dữ liệu.

Kiểm tra bảng Public API:

```bash
docker exec -it <postgres_container_name> psql -U estela_user -d estela_api
```

Trong psql:

```sql
\dt public.*
```

Nên thấy các bảng kiểu:

```txt
app_favorites
app_leads
app_notifications
app_payments
app_subscriptions
app_view_logs
app_vip_packages
```

---

## 7. Chạy mock/seed data cho Public API

Vào container public-api:

```bash
docker exec -it <public_api_container_name> sh
cd /app
```

Xem script seed:

```bash
cat package.json | grep -A 40 scripts
```

Nếu có Prisma seed:

```bash
npx prisma db seed
```

Nếu package có script seed:

```bash
yarn seed
```

hoặc:

```bash
npm run seed
```

Nếu source có file seed riêng, ví dụ `prisma/seed.ts`:

```bash
npx tsx prisma/seed.ts
```

Kiểm tra dữ liệu Public API:

```bash
docker exec -it <postgres_container_name> psql -U estela_user -d estela_api
```

Trong psql:

```sql
SELECT COUNT(*) FROM app_vip_packages;
SELECT COUNT(*) FROM app_subscriptions;
SELECT COUNT(*) FROM app_payments;
SELECT COUNT(*) FROM app_leads;
SELECT COUNT(*) FROM app_favorites;
SELECT COUNT(*) FROM app_notifications;
SELECT COUNT(*) FROM app_view_logs;

SELECT * FROM app_vip_packages ORDER BY id LIMIT 20;
```

---

## 8. Thứ tự chạy chuẩn sau khi deploy mới

Chạy theo thứ tự này để tránh lỗi:

```txt
1. Tạo database estela_cms và estela_api
2. Set env CMS trỏ vào estela_cms
3. Redeploy CMS
4. Chạy CMS schema: yarn bootstrap:schema
5. Chạy CMS seed: yarn seed hoặc yarn seed:all
6. Set env Public API trỏ vào estela_api
7. Redeploy Public API
8. Chạy Prisma schema: npx prisma db push hoặc npx prisma migrate deploy
9. Chạy Public API seed: npx prisma db seed hoặc yarn seed
10. Test frontend/public-api/CMS
```

---

## 9. Test nhanh sau khi chạy seed

Test CMS health:

```bash
curl -i https://<cms-domain>/livez
curl -i https://<cms-domain>/healthz
```

Test Public API health:

```bash
curl -i https://<api-domain>/api/health
```

Test app config:

```bash
curl -i https://<api-domain>/api/app-config
```

Test danh sách tin:

```bash
curl -i https://<api-domain>/api/properties
```

---

## 10. Ghi chú quan trọng

- CMS và Public API nên dùng 2 database riêng: `estela_cms` và `estela_api`.
- Không để Prisma public-api chạy vào database `estela_cms`.
- `PAYLOAD_DB_PUSH=true` chỉ tạo/sync schema CMS, không tự tạo mock data.
- Mock data phải chạy bằng seed script.
- Không nên tự động seed mỗi lần container start, vì có thể tạo trùng dữ liệu.
- Với production, nên dùng migration thay vì `db push` nếu schema đã ổn định.
