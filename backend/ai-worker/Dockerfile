FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/ai-worker/package.json backend/ai-worker/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY backend/ai-worker backend/ai-worker
RUN pnpm --filter @study-abroad/contracts build && pnpm --filter @study-abroad/spacetimedb-bindings build
RUN pnpm exec tsc -p backend/ai-worker/tsconfig.json
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/backend/ai-worker/dist backend/ai-worker/dist
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
CMD ["node", "backend/ai-worker/dist/runtime.js"]
