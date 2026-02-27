# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

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
