# Payload CMS Railway Deploy

This package deploys only the Payload CMS admin/API service to Railway.

## Railway settings

- Builder: Dockerfile
- Start command: `yarn start:railway`
- The Docker image builds Next.js during Docker build.
- Runtime only waits for Neon, bootstraps the Payload schema, then runs `next start`.

## Required Railway variables

Set these in Railway → Service → Variables:

```env
DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@<POOLER_HOST>/neondb?sslmode=require
DATABASE_URI=postgresql://neondb_owner:<PASSWORD>@<POOLER_HOST>/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:<PASSWORD>@<DIRECT_HOST>/neondb?sslmode=require

PAYLOAD_SECRET=change-me-long-random-secret
PAYLOAD_PUBLIC_SERVER_URL=https://your-railway-domain.up.railway.app
NEXT_PUBLIC_SERVER_URL=https://your-railway-domain.up.railway.app
FRONTEND_URL=https://uat-agreement.tpbs.com.vn
PUBLIC_API_PUBLIC_URL=https://api-uat-agreement.tpbs.com.vn
CORS_ORIGINS=https://uat-agreement.tpbs.com.vn,https://api-uat-agreement.tpbs.com.vn,https://your-railway-domain.up.railway.app
CSRF_ORIGINS=https://uat-agreement.tpbs.com.vn,https://api-uat-agreement.tpbs.com.vn,https://your-railway-domain.up.railway.app
PAYLOAD_SCHEMA_PUSH_ON_START=true
```

Optional R2 variables:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=
R2_ENDPOINT=
```

## Seed demo data

After deployment succeeds:

```bash
railway run yarn seed
```

## Notes

If Railway reports exit code `137`, it means the runtime container was killed due to memory pressure. This build moves `next build` from runtime to Docker build and uses `next build --webpack` to reduce Turbopack-related memory spikes.
