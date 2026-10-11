# Inventory stock control implementation map

## Scope and ownership

Task `task_b637c0f8097c`: Inventory Adjustment, Movement History and Cycle Count
(WBS 3.6.5 and 3.6.6). Own `src/features/inventory/**` and inventory admin
routes. The peer owns Back-office Order Management: lists/filters, detail,
standard/custom lines, reservations/payments/credit, production children,
release, holds and cancellation. Do not change the peer's feature or worktree.

## A0: verified repository architecture

- Routes use Next App Router; route pages compose exported feature components.
- `features/inventory/index.ts` is an empty public-API placeholder. No inventory,
  movement-history, adjustment or cycle-count routes currently exist.
- Feature modules define API calls, TanStack Query hooks, mutations, zod schemas,
  lifecycle/permissions, selectors and components. New input/DTO schemas must
  stay separate, and responses must be parsed at the API boundary.
- The shared axios client uses same-origin `/api`, auth and warehouse headers.
  Mock activation is controlled by the server-provided provider flag.
- The existing mock registry contains `/locations`, `/zones`, `/warehouses`,
  `/skus`, `/receipts` and `/move-tasks`. It has no inventory-adjustment,
  stock-movement or cycle-count API.
- `mock-data.ts` contains existing locations and move-task data; the referenced
  `stockMovements` export in production Appendix B does not exist. Move tasks
  are workflows, not authoritative ledger entries; do not synthesize ledger
  receipts/production issues/adjustments from them.
- Shareable filters/page/sort use nuqs (`useUrlFilters`). Presentation preferences
  use `usePageConfig`. Form state uses react-hook-form and zodResolver.
- Reuse PageHeader, ListToolbar, PageSkeleton, EmptyState, ConfirmDialog,
  column helpers and shared format utilities where their actual APIs fit.
- Shared DataTable owns local sorting/pagination, lacks controlled server-page
  props, and slices its input. Prefer inventory-local table/footer composition
  over changing a public abstraction used by the peer without coordination.
- Existing `inventory.view` permissions include Warehouse Staff, Warehouse
  Manager and Inventory Planner; `inventory.adjust` includes Warehouse Manager,
  with System Admin handled globally. Approval/count action policy needs the
  authoritative contract rather than guessed permissions.
- Shared status constants/maps have no adjustment or cycle-count lifecycle.
  New documented statuses must enter canonical constants before UI wiring.

## Contract evidence and unresolved inputs

The dispatched requirements identify F-CNT, SCRUM-424 and SCRUM-146, and require
mandatory reasons including SCRAP, SAMPLE, DAMAGE and SUBCONTRACT_LOSS.
The checkout does not include these business documents or REST contracts.
The project-referenced `D:\FPTU\Capstone\docs\docs\` location is not available
at `/mnt/d/FPTU/Capstone/docs/docs` in this Linux environment. An authoritative
source path and the agreed SCRUM-146 contract have been requested from the
coordinator before implementing domain behavior.

Required contract facts: endpoint paths/envelopes/field names, movement types and
filters, adjustment statuses/actions, threshold definition and approval policy,
stock quantity/lot/location semantics, count snapshot/count/review/post lifecycle,
posting atomicity/idempotency, and the resulting adjustment references.

### A1 upstream contract discovery

Connected GitHub access located the authoritative source repositories after A0:

- Business modules: `KLTN-FA26/docs` at
  `84b8b54df2551bfd4a6daedfa70587831791f72b` (00, 06, 11 and 19).
- Backend: `KLTN-FA26/be-backoffice-stockflow-commerce` develop at
  `1de8f42612be534539d98bbcf105d8b39c6d74a3`.
- F-CNT: backend `docs/business-design/04c-all-flows.md`, together with
  `05-business-rules.md` / BR-STK-005.
- Wire types/actions: `StockOperationsController`, `StockAdjustmentResponse`,
  `StockMovementResponse`, `RequestAdjustmentRequest`, `RejectAdjustmentRequest`,
  `StockAdjustment`, `AdjustmentStatus`, and `StockMovement`.

The implemented API prefix is `/api/v1/inventory`; successful responses use
`{ success: true, data: ... }`. PageResponse uses zero-based `page`, `size`,
`totalElements`, `totalPages`, `hasNext` and `hasPrevious`.

**Acceptance gaps escalated to the coordinator:** movement filtering currently
supports only SKU/location/type, with no date query. MovementType exposes RECEIPT,
MOVE, ADJUSTMENT and TRANSFER_OUT, without a production-issue type. Manual reasons
are DAMAGED, LOST, FOUND, EXPIRED, DATA_CORRECTION, SCRAP, SAMPLE and OTHER;
DAMAGE and SUBCONTRACT_LOSS are not supported. Every manual request enters
PENDING_APPROVAL and a different actor approves/posts or rejects; the requester
may withdraw. POSTED/REJECTED/WITHDRAWN are terminal. No configurable threshold or
approval tier is exposed in this contract; the frontend cannot manufacture one.

Backend `docs/SCRUM-146-147-298-split-handoff.md` confirms count code was removed,
and calls out unresolved blind-count/data-scope/four-eyes/reservation-shortage/
staleness/idempotent-post gates. It is a recovery reference, not an agreed REST
contract. The original coordinator question remains pending for that contract.

A1 adds inventory-local envelope/error adaptation and warehouse-aware query keys.
No shared axios/query factory or existing feature API behavior is changed.

## Proposed coherent checkpoints

1. **A1 inventory domain/API contracts:** transcribe supplied contracts into
   constants, schemas/types, lifecycle/actions and feature APIs/query keys;
   cover contract parsing, required reason, supported transitions and roles.
2. **A2 movement history:** ledger list with server pagination, type/date/SKU/
   location URL filters and loading/refetch/error/empty states; contract-backed
   mock routes only where source data exists.
3. **A3 adjustment:** list/detail/create form, mandatory reason and documented
   approval handling; invalidate ledger/inventory on confirmed stock changes.
4. **A4 count foundation:** isolate the agreed unavailable backend behind the
   feature transport boundary; add scope creation/list/detail without exposing
   adapter details to components/domain code.
5. **A5 count execution/post:** quantity entry, review of derived variances and
   documented posting result linking the resulting adjustment; prevent duplicate
   submissions and preserve server errors.
6. **A6 regression/integration:** resolve exact-commit peer reviews, perform
   self-review and run pnpm typecheck, lint, test and build separately (the
   current aggregate validate script invokes npm internally).

Each checkpoint gets a focused verification, immutable commit and coordinator
report before moving to the next substantial unit. Business-rule code requires
traceable source citations; missing backend facts must not become invented
responses or silent successful posting.

## Shared-change coordination

Report before any change to public routes/statuses/permissions, mock registration
or table abstractions. Prefer feature-owned inventory constants and additive
mock registration to minimize collisions with Order Management. Do not modify
protected mock-data, shadcn components or design-rule files.
