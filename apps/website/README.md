# EtsySentry Website

Non-functional frontend prototype for EtsySentry dashboard workflows.

## Scope

- Tabbed homepage views:
  - Listings
  - Keywords
  - Shops
  - Logs
- Dense table-first UX with mock data
- No backend wiring yet

## Run

```bash
bun install
bun run dev
```

`bun run dev` auto-selects the first available port, starting at `3100`.
Dev mode is forced to Webpack (`next dev --webpack`) and does not use Turbopack.

## Build

```bash
bun run build
```

Build mode is forced to Webpack (`next build --webpack`).
