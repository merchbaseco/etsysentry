# syntax=docker/dockerfile:1.6

FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=github_packages_token \
  MERCHBASE_GITHUB_NPM_TOKEN="$(cat /run/secrets/github_packages_token)" \
  bun install --frozen-lockfile
# Build the workspaces directly rather than through the root scripts: those run
# under `varlock run`, and the image has neither .env.schema (dockerignored) nor
# any 1Password access. The website uses same-origin requests and needs no
# build-time authentication values.
RUN bun run --cwd apps/server build
RUN bun run --cwd apps/website build

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
# The lifecycle signal inside the container: VARLOCK_ENV is a varlock builtin
# and is never delivered, so runtime code branches on NODE_ENV instead.
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000
EXPOSE 8080
CMD ["bun", "run", "--cwd", "apps/website", "start", "--", "--host", "0.0.0.0", "--port", "3000"]
