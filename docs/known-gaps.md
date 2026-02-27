# Known Gaps

This document tracks intentionally deferred behavior gaps that are known and accepted for now.

## 1) `tracked_shop_listings` Completeness and Freshness Is Not Fully Self-Healing

Status: accepted for now (deferred)

### Current Behavior

- Shop sync (`sync-shop`) runs in incremental mode and upserts listings returned by
  `findAllActiveListingsByShop` ordered by `updated_timestamp`.
- Listing sync (`sync-listing`) updates `tracked_shop_listings.isActive` by `etsyListingId`.
- Digital listings are now included in tiered listing sync and are hidden in dashboard listings by
  default unless `Show digital` is enabled.

### Gap

`tracked_shop_listings` does not currently have a dedicated, periodic full-reconciliation path.

This means table correctness converges under healthy sync behavior, but does not have a guaranteed
row-level self-heal if rows are missing or drifted outside normal job flow.

### Why This Matters

- `sync-listing` updates activity state for existing rows; it does not insert missing
  `tracked_shop_listings` rows.
- Incremental shop sync only upserts listings encountered in the current incremental fetch window.
- If a listing row is missing and that listing is never re-encountered as "changed," it can remain
  missing indefinitely.

### Realistic Drift Scenarios

- historical partial data before a complete initial capture,
- operational/manual database repair or accidental row deletion,
- transient upstream/API inconsistency during a capture window.

### User/Product Impact

- Shop listing-state tables can be "mostly correct" but not mathematically complete in all cases.
- Daily listing sync reduces activity-state staleness substantially, but does not guarantee full row
  completeness recovery.

### Deferred Mitigation Options

1. Add scheduled full shop reconciliation (for example every 7 days) in addition to daily
   incremental sync.
2. Trigger a full reconciliation sooner on drift signals:
   - repeated sync failures,
   - suspicious `activeListingCount` deltas,
   - explicit admin repair action.
3. Add observability checks comparing:
   - `tracked_shop_snapshots.activeListingCount`,
   - count of active rows in `tracked_shop_listings`,
   - and optionally sampled Etsy ground truth.

### Decision Notes

- Deferred to avoid immediate Etsy API/runtime expansion.
- Current behavior is acceptable given tiered sync cadence and expected data quality, with known
  caveats above.
