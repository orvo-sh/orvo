FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /repo

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/alerts-worker/package.json apps/alerts-worker/package.json
COPY packages/clickhouse/package.json packages/clickhouse/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/encryption/package.json packages/encryption/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/utils/package.json packages/utils/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .

RUN pnpm --filter alerts-worker build

FROM base AS runner

ENV NODE_ENV=production

COPY --from=build /repo /repo

WORKDIR /repo/apps/alerts-worker

CMD ["pnpm", "start"]
