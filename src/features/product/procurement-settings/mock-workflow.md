# Task 4A Step 3 — frontend interaction contract

`SkuDetail → ProcurementSettingsSection / Editor → FE draft / view model → service → mock service`

- Read-only by default; Edit is available only in mock mode. This is demo availability,
  not a production authorization decision. The Step 2 permission/HTTP blockers remain.
- React Hook Form, zodResolver, ProductFormField, shared Input/Button and the existing
  supplier table provide the editable workflow. Only existing mapping rows are edited.
- Blank numeric inputs stay `null`. Validation checks finite, nonnegative numbers only;
  it does not assert integer quantities, upper limits, divisibility or purchasing rules.
- Supplier choices contain existing fixture identities, not master purchasing terms.
  The default supplier is an independent reference, including suppliers outside the rows.
- `saveProcurementSettings` is a **mock interaction contract**, not a backend DTO or
  atomic backend save. The Inventory and Procurement write boundaries remain unresolved.
- Mock persistence is per SKU, in memory, and resets on page reload. Read/save return
  fresh snapshots; failed saves do not replace stored data. Factory-injected `beforeSave`
  makes failures and pending behavior reproducible without a speculative HTTP protocol.
- The existing reader is synchronous, without React Query. No query keys, cache mutation,
  HTTP calls or endpoint constants were introduced. A successful save displays the service
  response; subsequent service reads see the stored mock snapshot. Cancel unmounts the
  draft and shows the last accepted snapshot. SKU/mock-mode changes remount the section.
- Missing item lead time stays missing. `orderMultiple` remains an independent FE/story
  field. No `pack_size` adapter, `isPreferred`, default/preferred synchronization, version
  header or conflict behavior exists.

Before a real adapter: finalize inventory-item identity/provisioning; Java/HTTP read and
write contracts; separate versus coordinated saves; supplier mapping identity and required
creation fields; default/preferred authority; order-multiple meaning; numeric/null rules;
permission/resource/scope association and concurrency/failure handling. See `contract-audit.md`.
