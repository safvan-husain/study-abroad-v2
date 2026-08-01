FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY services/api/package.json services/api/package.json
COPY packages/contracts packages/contracts
COPY packages/spacetimedb-bindings packages/spacetimedb-bindings
RUN pnpm install --frozen-lockfile
COPY services/api services/api
RUN pnpm --filter @study-abroad/api build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/api/dist services/api/dist
COPY --from=build /app/services/api/package.json services/api/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
EXPOSE 3001
CMD ["node", "services/api/dist/main.js"]
