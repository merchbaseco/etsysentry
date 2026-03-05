# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## v0.2.0 - 2026-03-05

### Added

- Public API now supports canonical filters and nested read routes for keyword, listing, and shop
  retrieval workflows.
- Dashboard now includes keyword activity views with day-based rank movement context.
- Shops now include daily activity trends for sales and favorites with expanded activity tabs.
- Listing history now tracks ending timestamps and normalized listing tags for richer analysis.

### Changed

- Dashboard listing and shop views received layout, readability, and sparkline tooltip UX
  improvements.
- Server Etsy request handling now applies timeout retries to improve sync reliability.

## v0.1.1 - 2026-02-27

### Added

- CLI `list` commands now support `--limit` and `--offset` pagination controls.
- Dashboard settings now provide single-key API key management with validation-focused UX.

### Changed

- CLI now defaults to the hosted EtsySentry API base URL for first-run configuration.
- Server database query logging is disabled by default to reduce operational log noise.

## v0.1.0 - 2026-02-27

### Added

- Initial EtsySentry platform for tracking Etsy `keyword`, `listing`, and `shop` intelligence.
- Dashboard experience with dedicated Keywords, Listings, Shops, and Logs views.
- Etsy OAuth connection management, including connect, status, refresh, and disconnect flows.
- Account-level API key management for programmatic access.
- Public API surface (`api.public.*`) for tracking and listing keywords, listings, and shops.
- Listing performance retrieval in the public API for time-range analytics workflows.
- Official npm CLI package (`@etsysentry/cli`) with config commands (`show`, `set`, `clear`).
- CLI tracking commands for keywords, listings/products, and shops.
- CLI listing performance output for JSON and table workflows.
- Typed npm HTTP client package (`@etsysentry/http-client`) for API-key authenticated
  integrations.
- Realtime update channel for query invalidation, sync-state updates, and dashboard summary pushes.
- Admin and operations capabilities, including sync-all-listings enqueue and Etsy API usage status.
