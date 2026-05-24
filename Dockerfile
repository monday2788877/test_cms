# syntax=docker/dockerfile:1.7
# Debian-based image. Do NOT use Alpine here; Payload/Next/sharp native deps build more reliably on Debian slim.
FROM node:22-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Important: install devDependencies too because Next/Payload build needs TypeScript and tooling.
# Runtime command will set NODE_ENV=production when starting Next.
ENV YARN_PRODUCTION=false

# Build/runtime deps for Next.js + Payload + sharp/native modules.
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
# postinstall needs scripts/patch-payload-load-env.mjs during yarn install
COPY scripts ./scripts

RUN yarn install --non-interactive --network-timeout 600000

COPY . .

ARG PAYLOAD_SECRET=build-secret-change-me
ARG DATABASE_URI=
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ENV PAYLOAD_SECRET=$PAYLOAD_SECRET
ENV DATABASE_URI=$DATABASE_URI
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

# Do not run `yarn build` during docker build: Payload/Next can initialize DB adapters,
# and compose service hostnames such as `postgres` are not reachable from a BuildKit RUN layer.
# Build at container startup after postgres is healthy and reachable.
EXPOSE 3000
CMD ["yarn", "start:railway"]
