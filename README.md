# EtsySentry

Monorepo containing EtsySentry server and shared packages for Etsy performance intelligence.

## Purpose

EtsySentry tracks three primitives over time:

- `keyword` - monitors Etsy search rankings (pages 1-3 daily).
- `listing` - stores daily listing snapshots and performance signals.
- `shop` - discovers and monitors a shop's listings over time.

## Apps

- `apps/server` - Fastify + tRPC API and monitoring jobs
- `apps/website` - Vite + React Router dashboard frontend prototype (tabbed listings/keywords/shops/logs views)

## Packages

- `packages/http-client` - typed tRPC client for public API and CLI workflows

## API Design

- All API surfaces are tRPC (no REST by default).
- Public surface: `api.public.*` (agent/CLI).
- App surface: `api.app.*` (dashboard/admin).

## Integration Design

- Etsy API v3 only.
- Bridge pattern required: one Etsy endpoint per bridge file, thin wrappers only.
- Business logic and persistence live outside bridge files.

## Docs

- `AGENTS.md` - assistant implementation rules and code style requirements
- `docs/requirements.md` - product requirements and scope
- `docs/architecture.md` - system architecture and module boundaries
- `docs/cli-spec.md` - canonical CLI command shape and behavior
- `docs/api-spec.md` - canonical `api.public.*` contract shared by CLI and HTTP client
- `docs/log-view.md` - rich event log UX and storage specification
- `apps/server/README.md` - server-specific runbook

## Quick Start

### Website Prototype

```bash
bun install
bun run dev
```
