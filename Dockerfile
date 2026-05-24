# syntax=docker/dockerfile:1.7
# Railway Payload CMS image.
# Use Debian slim instead of Alpine for Payload/Next/sharp native dependencies.
FROM node:22-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV YARN_PRODUCTION=false
# Keep build memory under control on small Railway containers/builders.
ENV NODE_OPTIONS=--max_old_space_size=768
ENV NEXT_PRIVATE_BUILD_WORKER_COUNT=1
# Build-time fallback only. Railway runtime variables override these values.
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

COPY package.json yarn.lock* ./
# postinstall needs scripts/patch-payload-load-env.mjs during yarn install.
COPY scripts ./scripts
RUN yarn install --non-interactive --network-timeout 600000

COPY . .

# Build at image build time, not at Railway runtime.
# Next.js 16 uses Turbopack by default; package.json uses `next build --webpack`
# to avoid Turbopack memory spikes on Railway.
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start:railway"]
