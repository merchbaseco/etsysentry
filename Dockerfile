FROM oven/bun:1.3.5-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN bun install --frozen-lockfile
RUN bun run website:build

FROM oven/bun:1.3.5-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app /app

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/website", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
