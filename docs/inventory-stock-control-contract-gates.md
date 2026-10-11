# Inventory stock control: contract gates

Task: `task_b637c0f8097c`. Implemented checkpoints: A0 `297480e`,
A1 `7e07ef1`, A2 `80e0422`, A3 `67614d2`.

**The complete dispatched feature is not ready for acceptance.** Movement History
and Inventory Adjustment implement the available SCRUM-424 contract. Cycle Count
has no agreed wire contract in the inspected sources and remains unimplemented.
Coordinator question `msg_781450615186` requests that contract and scope decisions.
This document records evidence and decisions required, not an agreed API.

## Source pins

- [Business docs](https://github.com/KLTN-FA26/docs/tree/84b8b54df2551bfd4a6daedfa70587831791f72b):
  modules 00, 06, 11, 19.
- [Backend source](https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/tree/1de8f42612be534539d98bbcf105d8b39c6d74a3):
  StockOperationsController, StockAdjustment/StockMovement domain classes and DTOs.
- [F-CNT](https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/1de8f42612be534539d98bbcf105d8b39c6d74a3/docs/business-design/04c-all-flows.md)
  and BR-STK-005 describe counting and posting variance as stock adjustments.
- [SCRUM-146 recovery handoff](https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/1de8f42612be534539d98bbcf105d8b39c6d74a3/docs/SCRUM-146-147-298-split-handoff.md):
  count implementation was removed; recovery snapshot is not a merge-ready contract.

## Acceptance gaps requiring a decision

| Requirement             | Available evidence                                           | Required decision                                                                                                                      |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Date filtering          | Movement controller accepts SKU/location/type/page/size only | Supply server date parameters, timezone and inclusive/exclusive boundaries; filtering one loaded page would misrepresent ledger totals |
| Production issues       | Movement enum is RECEIPT/MOVE/ADJUSTMENT/TRANSFER_OUT        | Supply the authoritative production-issue representation/filter; do not relabel every transfer as production consumption               |
| DAMAGE reason           | Manual enum exposes DAMAGED                                  | Confirm DAMAGED satisfies the intended requirement or provide the revised backend enum                                                 |
| SUBCONTRACT_LOSS reason | Absent from request enum                                     | Supply the supported contract; do not send an enum the backend rejects                                                                 |
| Threshold approval      | Every manual request is pending; approval also posts         | Confirm current all-request approval behavior or provide threshold unit/value/tier/response fields                                     |
| Cycle Count             | F-CNT and DB schema exist; no agreed REST contract found     | Supply or explicitly agree the contract before implementing an interim adapter                                                         |

## Cycle Count agreement checklist

The database identifies a count, warehouse, trigger type, lifecycle state, blind
flag, assigned user, dates, note and version. Count lines identify count/location/
SKU/lot, expected and counted quantities, counting actor/time, recount flag and
version. These storage facts do not establish HTTP request/response shapes,
authorization, allowed edits, or server-managed stock behavior.

The agreed contract must resolve:

1. Creation scope: zone/location selection, eligible locations and stock lines,
   assignment, blind-count visibility and warehouse-scoped access.
2. Count snapshot: expected quantity semantics, stock movement while counting,
   lot identity and whether undiscovered SKU/lot lines may be added.
3. Quantity entry: allowed units/range, partial save, version conflict handling,
   recount ownership and completion criteria.
4. Review: authoritative variance and any threshold, reviewer role, four-eyes
   constraint, rejection/recount behavior and zero-variance path.
5. Posting: authorized lifecycle transition, atomic stock/ledger/adjustment
   update, reserved-stock shortage behavior, stale snapshot detection and
   idempotency across retries.
6. Result: adjustment identifiers/references and posted count state, including
   whether COUNT_VARIANCE adjustments are already posted or separately approved.
7. Wire boundary: endpoints, envelope/error shapes, pagination/filter inputs,
   nullable fields and interim data source that is allowed by the story.

F-CNT describes PLANNED → COUNTING → VARIANCE_REVIEW → APPROVED → POSTED,
cancellation from PLANNED and a zero-variance shortcut. The recovery handoff
flags blind count, warehouse scope, four-eyes, reservations, staleness and
idempotency as unresolved gates. A status diagram alone cannot justify a
successful simulated posting response.

## Proposed implementation boundary after agreement

Keep count schemas/types/lifecycle/selectors and UI in the inventory feature.
Expose count operations through a dedicated feature API interface and select
the real or authorized interim transport outside components. Both transports
must parse the same agreed DTOs and preserve the same failure semantics.
Posting must return an authoritative result; client-side variance calculation
may support review but must not mutate stock or manufacture adjustment IDs.
This boundary permits replacing the interim transport without rewriting forms,
query hooks or domain logic. No proposed HTTP paths or success fixtures are
treated as accepted contracts in the current code.

## Existing implementation and verification limits

Adjustment routes are `/admin/inventory/adjustments`, `/create`, and `/{id}`.
Movement History is `/admin/movements`. Lists use server pagination
and URL filters; requests parse envelopes and DTOs, and query keys include the
active warehouse. Approval invalidates adjustment, movement and stock queries.
Tests use isolated MSW responses and test-only records, never production rows.

The existing mock registry has no inventory ledger/adjustment/count endpoints
or source ledger records. Mock-mode inventory requests therefore show errors;
they do not succeed with invented stock data. Live backend integration has not
been exercised. No peer checkpoint SHA or review response has been received.

Full regression on A3 passed: `corepack pnpm run typecheck`, `corepack pnpm run
lint`, `corepack pnpm run test` (14 files, 81 tests), and `corepack pnpm run build`
(27 generated static pages, including the adjustment routes). Vitest reports
an existing Vite config-loader compatibility warning; no validation failures
were observed. Passing these checks verifies the implemented subset, not the
missing acceptance requirements above.
