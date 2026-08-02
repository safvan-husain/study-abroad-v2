FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_SPACETIME_URL
ARG NEXT_PUBLIC_SPACETIME_DATABASE=study-abroad-coordinator
ENV NEXT_PUBLIC_SPACETIME_URL=$NEXT_PUBLIC_SPACETIME_URL
ENV NEXT_PUBLIC_SPACETIME_DATABASE=$NEXT_PUBLIC_SPACETIME_DATABASE
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY docker/.npmrc .npmrc
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts packages/contracts
COPY packages/spacetimedb-bindings packages/spacetimedb-bindings
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
