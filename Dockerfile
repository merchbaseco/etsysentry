FROM oven/bun:1.3.5-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN bun install --frozen-lockfile
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
