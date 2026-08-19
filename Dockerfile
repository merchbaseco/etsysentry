# syntax=docker/dockerfile:1.6

FROM oven/bun:1.3.5-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_SERVER_ORIGIN
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_SERVER_ORIGIN=${VITE_SERVER_ORIGIN}

COPY . .
RUN --mount=type=secret,id=merchbase_github_npm_token \
  MERCHBASE_GITHUB_NPM_TOKEN="$(cat /run/secrets/merchbase_github_npm_token)" \
  bun install --frozen-lockfile
RUN bun run server:build
RUN bun run website:build

FROM oven/bun:1.3.5-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app /app

EXPOSE 3000
EXPOSE 8080
CMD ["bun", "run", "--cwd", "apps/website", "start", "--", "--host", "0.0.0.0", "--port", "3000"]
