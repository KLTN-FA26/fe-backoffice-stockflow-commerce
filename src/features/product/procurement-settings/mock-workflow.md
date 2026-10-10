# Task 4A Step 3 — frontend interaction contract

`SkuDetail → ProcurementSettingsSection / Editor → FE draft / view model → service → mock service`

- Read-only by default; Edit is available only in mock mode. This is demo availability,
  not a production authorization decision. Procurement's supplier/default-supplier
  permission and HTTP gaps remain; Inventory Control now has a separate BE contract.
- Inventory Control exclusively owns `reorderPoint`. Procurement's view/draft/save
  models and mock store do not contain it, and the section does not display or edit it.
  The reader accepts only SKU identity and mock mode, never a legacy SKU threshold.
- React Hook Form, zodResolver, ProductFormField, shared Input/Button and the existing
  supplier table provide the editable workflow. Only existing mapping rows are edited.
- Genuinely blank numeric inputs stay `null`; native browser `badInput` cannot clear values.
  Validation checks numeric syntax, finite/nonnegative values and safe integer representation.
  Decimals remain allowed for the supplier-row FE fields; these checks impose no
  purchasing limits or quantity rules and do not define Inventory Policy validation.
- Read-only numbers have no fixed fractional cutoff. Machine-precision display simplifications
  carry an approximation marker and expose the original stored number in the title; saved data
  is never rounded by the formatter.
- Supplier choices contain existing fixture identities, not master purchasing terms.
  The default supplier is an independent reference, including suppliers outside the rows.
- Duplicate supplier selections in mapping rows prevent Save and show an inline error on each
  affected row. Options remain selectable, no other row is modified, and correcting the draft
  permits Save. This is draft integrity for one SKU, not a future HTTP error contract; the
  independent default supplier does not participate in the duplicate check.
- Procurement's fixed-layout table reuses the shared horizontal scroll container on narrow
  screens. Supplier names and item codes wrap without trimming stored text; the SKU column
  can shrink so long content does not widen its surrounding grid. Editing keeps full values.
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

Before a real Procurement adapter: finalize resolution of canonical inventory-item identity;
default-supplier and supplier-item Java/HTTP read and write contracts; separate versus
coordinated saves; supplier mapping identity and required
creation fields; default/preferred authority; order-multiple meaning; numeric/null rules;
permission/resource/scope association and concurrency/failure handling. See `contract-audit.md`.

The current Inventory Control endpoint enforces Product READ/UPDATE despite separate
Inventory Item permission seeds. That authorization mismatch remains a Task 4B blocker;
this ownership correction does not resolve it or add Inventory Control UI/integration.
