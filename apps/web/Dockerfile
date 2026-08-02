FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY docker/.npmrc .npmrc
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts packages/contracts
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
RUN pnpm --filter @study-abroad/web build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
