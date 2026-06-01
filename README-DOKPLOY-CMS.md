# Deploy `test-cms` trên Dokploy bằng Dockerfile

## Cấu hình app Dokploy

Nếu Dokploy hỗ trợ Root Directory:

```txt
Build Type: Dockerfile
Root Directory: cms
Dockerfile Path: Dockerfile
Port: 3000
Health Check Path: /healthz
```

Nếu Dokploy không có Root Directory, dùng Dockerfile ở root repo:

```txt
Build Type: Dockerfile
Dockerfile Path: Dockerfile.test-cms
Port: 3000
Health Check Path: /healthz
```

## Env bắt buộc

```env
PORT=3000
NODE_ENV=production

DATABASE_URI=postgresql://user:password@postgres-host:5432/dbname
DATABASE_URL=postgresql://user:password@postgres-host:5432/dbname
PAYLOAD_SECRET=replace_with_long_random_secret
PAYLOAD_DB_PUSH=true

PAYLOAD_PUBLIC_SERVER_URL=https://cms-domain.example.com
NEXT_PUBLIC_SERVER_URL=https://cms-domain.example.com
FRONTEND_URL=https://frontend-domain.example.com
NEXT_PUBLIC_FRONTEND_URL=https://frontend-domain.example.com
PUBLIC_API_URL=https://api-domain.example.com/api
SITE_URL=https://frontend-domain.example.com

CORS_ORIGINS=https://frontend-domain.example.com,https://api-domain.example.com,http://localhost:5173
CSRF_ORIGINS=https://frontend-domain.example.com,https://api-domain.example.com,http://localhost:5173

CMS_INTERNAL_URL=https://cms-domain.example.com
CMS_INTERNAL_CLEANUP_TOKEN=replace_with_random_secret
ADMIN_INTERNAL_TOKEN=replace_with_random_secret
```

## Env R2 nếu dùng Cloudflare R2

```env
R2_ENABLED=true
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ENDPOINT=https://your_cloudflare_account_id.r2.cloudflarestorage.com
R2_BUCKET=your_bucket_name
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_PUBLIC_URL=https://media-domain.example.com
R2_REGION=auto
```

## Test sau deploy

```bash
curl -i https://cms-domain.example.com/livez
curl -i https://cms-domain.example.com/healthz
```

`/livez` chỉ kiểm tra process còn sống. `/healthz` kiểm tra cả Payload/Postgres/schema.

## Lưu ý Postgres

Lần đầu deploy test/UAT nên để:

```env
PAYLOAD_DB_PUSH=true
```

Khi production ổn định thì nên chuyển sang migration Payload thay vì push schema tự động.
