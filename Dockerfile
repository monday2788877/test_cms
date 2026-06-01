# syntax=docker/dockerfile:1.7
# Payload CMS / Next.js image for Dokploy Dockerfile builds.
# Build context should be the cms/ folder when using this Dockerfile directly.
FROM node:22-bookworm-slim AS app

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV YARN_PRODUCTION=false
ENV NODE_OPTIONS=--max_old_space_size=1024
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=1

# Build-time placeholders only. Real values must be configured in Dokploy Environment.
ENV DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder
ENV DATABASE_URI=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder
ENV PAYLOAD_SECRET=build-secret-change-me
ENV NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ENV PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    openssl \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json ./
# postinstall needs scripts/patch-payload-load-env.mjs during yarn install.
COPY scripts ./scripts
RUN yarn install --non-interactive --network-timeout 600000

COPY . .
RUN yarn build

ENV NODE_ENV=production
EXPOSE 3000

# start:docker waits for DB, bootstraps Payload schema, then runs Next.
CMD ["yarn", "start:docker"]
