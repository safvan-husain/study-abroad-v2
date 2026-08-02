FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY docker/.npmrc .npmrc
COPY backend/ai-worker/package.json backend/ai-worker/package.json
COPY packages packages
COPY scripts/catalog scripts/catalog
RUN pnpm install --frozen-lockfile
COPY backend/ai-worker backend/ai-worker
RUN pnpm --filter @study-abroad/contracts build && pnpm --filter @study-abroad/ai-worker build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json package.json
COPY --from=build /app/pnpm-workspace.yaml pnpm-workspace.yaml
COPY --from=build /app/backend/ai-worker/package.json backend/ai-worker/package.json
COPY --from=build /app/backend/ai-worker/dist backend/ai-worker/dist
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/scripts/catalog scripts/catalog
RUN mkdir -p node_modules/@study-abroad \
  && ln -sf ../../packages/contracts node_modules/@study-abroad/contracts \
  && ln -sf ../../packages/spacetimedb-bindings node_modules/@study-abroad/spacetimedb-bindings
CMD ["node", "backend/ai-worker/dist/runtime.js"]
