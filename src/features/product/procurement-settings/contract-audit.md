# Procurement Settings contract audit — Task 4A Step 2

Audited remote BE `develop` at `c716da2a45e54f489ca2c9b526059918d532e08a`
(2026-10-09). The original local BE checkout was at `276567d`; this audit used a
temporary checkout of the verified remote revision. Findings describe source,
not a deployed database or running API.

## Domain trace

- [Inventory schema][inventory-schema]: `inventory.inventory_items` is unique by
  SKU, with a FK to `product.variants.sku`. It owns `reorder_point` and
  `default_supplier_id`; the latter references `procurement.suppliers`.
- No Java entity, repository, domain object, service, DTO, or controller maps
  `inventory_items` or exposes either setting. The existing inventory chain is
  `inventory.stock_item` → [StockItemJpaEntity][stock-entity] → repository/persistence
  mapper → `StockItem` → `InventoryServiceImpl` → [InventoryController][inventory-controller]
  / `StockItemResponse`. It represents quantities by SKU/location/lot, not item settings.
- [Supplier-item schema][supplier-schema]: `procurement.supplier_items` references
  a supplier and an inventory item. It contains `supplier_sku_code`, `moq`,
  `pack_size`, `lead_time_days`, and `is_preferred`.
- No SupplierItem Java entity, repository, domain object, service, DTO, or
  controller exists. [SupplierJpaEntity][supplier-entity] still maps the old
  singular `procurement.supplier`, without lead time or item buying terms.
  `SupplierJpaRepository` feeds `PurchaseOrderRepositoryAdapter.supplierStatus`;
  [ProcurementServiceImpl][po-service] checks supplier status when creating a PO
  and explicitly states that per-SKU MOQ is not enforced. `PoLine` only requires
  a positive ordered quantity; it does not apply pack-size multiples.
- Pending C3/C4 migrations explicitly await application migration to the new
  inventory-item/procurement model. Current Product DTOs do not expose these settings.

## Four open questions

| Question                           | Resolution                                                        | Evidence / consequence                                                                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack_size` = order multiple       | **NOT SUPPORTED by current production Java**                      | Two separate tables have `pack_size`. SQL only enforces `>= 1`; no Java field, quantity rounding, divisibility rule, or HTTP DTO establishes an order-multiple meaning. FE `orderMultiple` remains a story display placeholder, not an alias for either column. |
| Default supplier authority         | **Unresolved**                                                    | The inventory default and mapping preferred flag are independent. No synchronization, derivation, selection precedence, or disagreement handler exists.                                                                                                         |
| Item → supplier lead-time fallback | **Unresolved; not implemented**                                   | Both expanded tables have nullable lead time with SQL default 7. These are independent insertion defaults, not fallback logic. The live Java supplier entity has neither field.                                                                                 |
| Permission ownership               | **Seeded resource codes confirmed; endpoint enforcement missing** | Inventory-item and supplier-item resources/actions exist in the migration, but have no Java resource declaration, route/API association, or endpoint scope.                                                                                                     |

The unique partial index on `supplier_items(inventory_item_id) WHERE is_preferred`
allows **at most one** preferred mapping per inventory item, including none. Its
comment says replenishment proposes that supplier by default; current Java does
not implement that behavior. The inventory default need not have any mapping.
Disagreement is permitted by the schema. Removing a mapping does not clear the
inventory default. Deleting a supplier cascades its mappings and sets the
inventory default to NULL. No synchronization behavior should be inferred.

## Read composition and write ownership

| FE field                       | Persistence source                                                     | Owner                                             | Current write contract         |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------ |
| SKU identity                   | `inventory_items.sku` → `product.variants.sku`                         | Inventory / Product identity                      | Missing item-settings contract |
| Reorder point                  | `inventory_items.reorder_point`                                        | Inventory                                         | MISSING                        |
| Default supplier               | `inventory_items.default_supplier_id`                                  | Inventory; references Procurement supplier master | MISSING                        |
| Mapping and supplier item code | `supplier_items.supplier_id`, `inventory_item_id`, `supplier_sku_code` | Procurement                                       | MISSING                        |
| Item lead time and MOQ         | `supplier_items.lead_time_days`, `moq`                                 | Procurement                                       | MISSING                        |
| Preferred mapping              | `supplier_items.is_preferred`                                          | Procurement                                       | MISSING                        |
| Order multiple                 | No confirmed source                                                    | Unresolved                                        | MISSING                        |

The FE can compose these into one SKU-level read view. There is no implemented BE
aggregate or single save command covering them. Schema ownership identifies two
potential write boundaries, Inventory and Procurement; actual API boundaries are
not implemented. A future single save would require BE transaction orchestration
and authorization for both resources, rather than FE promises of atomicity.

Both new tables contain `version`, but no mapped entity or request currently
defines concurrency handling for these settings. Future writes must address stale
updates to separate rows, competing preferred selections (the unique index can
reject them), and consistency between default supplier and mappings. A composite
read also has no current snapshot-consistency contract. SQL constraints alone do
not define version preconditions, conflict responses, or rollback behavior.

## Existing HTTP contract matrix

All current controllers and DTOs were searched, including Product, Inventory,
Procurement, and other modules. Existing stock endpoints return quantities;
PO endpoints and supplier-spend reports do not return supplier-item settings.

| FE requirement                | Existing endpoint | Request | Response | Ready? |
| ----------------------------- | ----------------- | ------- | -------- | ------ |
| Read reorder point            | MISSING           | MISSING | MISSING  | No     |
| Update reorder point          | MISSING           | MISSING | MISSING  | No     |
| Read default supplier         | MISSING           | MISSING | MISSING  | No     |
| Update default supplier       | MISSING           | MISSING | MISSING  | No     |
| List supplier mappings by SKU | MISSING           | MISSING | MISSING  | No     |
| Create mapping                | MISSING           | MISSING | MISSING  | No     |
| Update mapping                | MISSING           | MISSING | MISSING  | No     |
| Remove mapping                | MISSING           | MISSING | MISSING  | No     |

## Permissions

[Permission migration][permissions] states these codes are seeded ahead of code:

| Ownership               | Resource                     | Read / update permission                                               | Other actions                      | Route/API and scope                     |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Inventory item settings | `inventory-inventory-items`  | `inventory-inventory-items:READ`, `inventory-inventory-items:UPDATE`   | VIEW_PAGE, CREATE, EXPORT          | Not declared in Java; scope unspecified |
| Supplier-item mappings  | `procurement-supplier-items` | `procurement-supplier-items:READ`, `procurement-supplier-items:UPDATE` | VIEW_PAGE, CREATE, DELETE          | Not declared in Java; scope unspecified |
| Supplier master         | `procurement-suppliers`      | `procurement-suppliers:READ`, `procurement-suppliers:UPDATE`           | VIEW_PAGE, CREATE, APPROVE, EXPORT | Seed only on current develop            |

Warehouse Manager and Inventory Planner receive all item actions; Warehouse Staff
and Procurement Staff receive item VIEW_PAGE/READ. Procurement Staff receive all
supplier-item actions. These seeded grants are editable; they are not FE role rules.
There is no dedicated SKU procurement-settings resource or combined permission.

The live `inventory-stock-items` resource belongs to stock availability and
movements/adjustments, not inventory-item settings. Its stock-item GET uses
WAREHOUSE scope; that scope cannot be transferred to the missing settings API.
The live `product-products` resource associates `/admin/products` with
`/api/v1/products`; Product READ/UPDATE cannot establish authorization to edit
the Inventory/Procurement data merely because the FE section appears under a SKU.

## FE audit and remaining blockers

Corrected the default supplier lookup so it does not require membership in mapping
rows. Added an independent display name with ID fallback. Non-mock settings now
keep reorder point unknown instead of treating the legacy SKU/mock value as a BE
inventory-item read. Comments preserve the unresolved order-multiple mapping,
preferred/default distinction, lead-time fallback, and separate write ownership.
The FE performs no pack-size conversion, preferred derivation, lead-time fallback,
or atomic save. Fixtures remain explicitly illustrative.

Before real integration/editing: implement and publish item/mapping read and write
DTOs/endpoints; confirm pack-size meaning and quantity units; decide default/preferred
authority and disagreement behavior; decide lead-time fallback; attach seeded
permissions to controllers with scopes; and specify versions, conflicts, and whether
one save is coordinated by BE or separate operations are intentional.

The contract must also define SKU-string to inventory-item UUID resolution and
inventory-item provisioning: the FK/unique key prevents duplicate item rows but does
not create one for every variant. Mapping creation must address the schema's required
positive `current_price` and currency, which this story's FE settings do not collect.
No price derivation or identity conversion is assumed by the FE fixture layer.

[inventory-schema]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/resources/db/migration/V20260928003000__inventory_items.sql
[supplier-schema]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/resources/db/migration/V20260928002000__proc_supplier_master.sql
[stock-entity]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/java/com/stockflow/inventory/internal/entity/StockItemJpaEntity.java
[inventory-controller]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/java/com/stockflow/inventory/internal/controller/InventoryController.java
[supplier-entity]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/java/com/stockflow/procurement/internal/entity/SupplierJpaEntity.java
[po-service]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/java/com/stockflow/procurement/internal/service/ProcurementServiceImpl.java
[permissions]: https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/c716da2a45e54f489ca2c9b526059918d532e08a/src/main/resources/db/migration/V20260928006000__permissions_new_resources.sql
