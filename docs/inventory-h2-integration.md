# Inventory H2 integration fix

Inventory endpoints omit `/v1` and successful transport responses are validated
directly from `response.data`. Backend error codes, field errors, correlation IDs,
and the shared 401 refresh path remain unchanged.

`INVENTORY_QUERY_KEYS.stock` references `SHARED_QUERY_ROOTS.inventoryStock`.
The shared constants file is copied exactly from Orders commit `2cd554a` so it can
merge unchanged. This Inventory branch contains no reservation queries.

## Validation

- Focused Inventory: 9 files, 59 tests passed.
- Full repository: 14 files, 82 tests passed, including auth and URL state regressions.
- Typecheck, lint, and production build passed.
- MSW tests cover backend success envelopes after shared unwrapping, bare data,
  invalid DTOs, failed success-status envelopes, and backend error details.
- No Order feature code changed.

## Required shared integration

This branch predates the Orders shared client/rewrite changes. Its production
client still leaves successful responses wrapped and its rewrite defaults to
backend `/api`, rather than `/api/v1`. The Inventory tests install a test-only
interceptor implementing the agreed success-unwrapping contract and use the
`http://localhost/api/v1` base URL; they do not prove that this branch's older
production client already implements that contract.

The coordinator must combine this patch with the newer shared client/rewrite
before live use, remove the test-only interceptor when tests can exercise that
real shared baseline, and rerun combined transport and Orders regression tests.
The Orders fix commit exists in Git but is not an ancestor of this branch; it was
not merged during this Inventory-only task. No live backend test was performed.
