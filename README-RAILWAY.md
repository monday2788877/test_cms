# Payload CMS Railway Deploy

This package is the standalone Payload CMS admin service for the real-estate project.

## What is included

- Payload CMS 3.84.1
- Next.js 16.2.6
- PostgreSQL adapter for Neon
- Cloudflare R2 storage config
- Real-estate collections: Users, Properties, Media, Districts, App Configs
- Seed script with demo admin/user/properties/districts/media
- Railway-ready Dockerfile and `railway.toml`

## Railway setup

Create a Railway service from this folder/repo.

If deploying from the full monorepo, set:

```txt
Root Directory: apps/payload-admin
```

If deploying this zip as its own repository, the root directory is already correct.

## Required variables

Copy variables from `.env.railway.example` into Railway Variables.

Minimum required:

```env
DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URI=postgresql://neondb_owner:<PASSWORD>@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://neondb_owner:<PASSWORD>@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
PAYLOAD_SECRET=change-me-to-a-long-random-secret
PAYLOAD_PUBLIC_SERVER_URL=https://your-payload-service.up.railway.app
NEXT_PUBLIC_SERVER_URL=https://your-payload-service.up.railway.app
PAYLOAD_SCHEMA_PUSH_ON_START=true
```

Railway provides `PORT` automatically. The app listens on `${PORT:-3000}`.

## Build and start

The Dockerfile installs dependencies. The Railway start command runs:

```bash
yarn start:railway
```

which does:

```txt
wait for Neon DB
bootstrap Payload schema or run migrations
next build
next start using Railway PORT
```

For strict production, set:

```env
PAYLOAD_SCHEMA_PUSH_ON_START=false
```

and use generated Payload migrations instead of schema bootstrap.

## Seed demo data on Railway

After first deploy succeeds, run in Railway shell/CLI:

```bash
yarn seed
```

Demo accounts:

```txt
Admin: admin@gmail.com / 123456
User:  user@gmail.com / 123456
```

## Public API config

If your NestJS Public API is deployed separately, set its env:

```env
PAYLOAD_INTERNAL_URL=https://your-payload-service.up.railway.app
```

Do not add `/api` at the end. The API code appends `/api/...` by itself.

## Security note

Do not commit real Neon or R2 secrets to Git. Rotate the Neon password if it has been pasted into chat or logs.


## Railway Dockerfile note

Dockerfile đã bỏ BuildKit cache mount (`--mount=type=cache`) để tránh lỗi Railway: `flag --mount=type=cache ... is missing an id argument`. Build sẽ dùng `RUN yarn install` thường, ổn định hơn trên Railway.
