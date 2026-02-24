# Etsy OpenAPI Bridge Implementation Guide

Source of truth for Etsy endpoint contracts:
- `https://www.etsy.com/openapi/generated/oas/3.0.0.json`

This repository uses one bridge file per Etsy endpoint in:
- `apps/server/src/services/etsy/bridges`

## Required Bridge Pattern

Each bridge file must:
1. Wrap exactly one Etsy endpoint operation.
2. Define typed input/output for that operation.
3. Perform only transport concerns:
   - request URL and query construction
   - headers/auth wiring
   - response validation and field mapping
   - Etsy error normalization

All Etsy bridge HTTP requests must use the shared guarded request helper:
- `apps/server/src/services/etsy/fetch-etsy-api.ts`
- `apps/server/src/services/etsy/get-etsy-api-key-header-value.ts`

This guard provides transport-level safety only:
- local request pacing using configured defaults
- runtime updates from Etsy response headers (`x-limit-*`, `x-remaining-*`)
- `retry-after` handling on rate-limit responses
- exponential backoff fallback when `retry-after` is missing

Each bridge file must not:
1. Access the database.
2. Run orchestration logic (batching, retries, scheduling).
3. Apply cross-endpoint business rules.

## OpenAPI-Driven Workflow

When adding or updating a bridge:
1. Find the `operationId` in Etsy OpenAPI.
2. Copy path/query parameter names exactly from the spec.
3. Implement request input validation in the bridge.
4. Parse the response with a schema that matches the endpoint shape.
5. Map Etsy JSON field names to service-friendly output fields.
6. Add tests for:
   - success mapping
   - query parameter serialization (if applicable)
   - non-2xx error mapping
   - invalid input handling

## Query Parameter Conventions

- Use exact Etsy parameter names over the wire.
- Keep boolean values serialized as `"true"` / `"false"`.
- For array query params (for example `includes`), append one key per value.

Example (`getListing`):
- `includes=Shop&includes=Images`
- `language=en`
- `legacy=true`
- `allow_suggested_title=true`

## Error Handling Conventions

- If Etsy returns non-2xx, throw a bridge-scoped error type.
- Preserve HTTP status code and raw response body on the error object.
- Try to extract Etsy `error_description`, `message`, or `error` for readable diagnostics.

## Current OpenAPI-Aligned Example

- Bridge: `apps/server/src/services/etsy/bridges/get-listing.ts`
- OpenAPI operation: `getListing`
- Path: `/v3/application/listings/{listing_id}`
- Supported optional query params:
  - `includes`
  - `language`
  - `legacy`
  - `allow_suggested_title`

## Current OpenAPI-Aligned Search Example

- Bridge: `apps/server/src/services/etsy/bridges/find-all-listings-active.ts`
- OpenAPI operation: `findAllListingsActive`
- Path: `/v3/application/listings/active`
- Supported optional query params:
  - `limit`
  - `offset`
  - `keywords`
  - `sort_on`
  - `sort_order`
  - `min_price`
  - `max_price`
  - `taxonomy_id`
  - `shop_location`
  - `legacy`
