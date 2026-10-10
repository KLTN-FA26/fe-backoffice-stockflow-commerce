# Inventory Control read boundary

Verified against BE `origin/feature/legacy-tables-removal` commit
`8ea4ca156643dfaee8541e8f4ce16b720a7dc56f`:
`InventoryControlController`, `InventoryControlResponse`, `InventoryControlWebMapper`,
`SkuInventoryControlService`, `InventoryPolicy`, `StockThresholdEvaluation`, and Jackson configuration.

GET `/api/v1/products/{productId}/skus/{skuId}/inventory-control` takes canonical
Product and Variant UUIDs. Response `skuId` is the canonical Variant UUID, not an
inventory-item ID. The service validates Product/Variant ownership. The shared
HTTP client unwraps ApiResponse; the feature validates the DTO and requested Variant identity.

Boxed nullable thresholds, shelf life, and evaluation booleans are omitted by
Jackson NON_NULL. Required primitive version, expiryTracked, usableOnHand and
identity/enums remain required. Explicit JSON null is not the confirmed wire shape.
The mapper normalizes omitted nullable values to FE null without losing zero or false.
Java long values must be safely representable as JavaScript integers to avoid silent loss.

Policy is global per SKU. Evaluation is returned by BE; FE does not calculate it.
Version is the inventory-item policy version retained for later editing, not editable data.
Procurement Settings has no dependency on this reader or policy.

GET currently enforces `product-products:READ`. Inventory-item resources are seeded
separately: Product-versus-Inventory authorization remains a BE/product decision.
No Inventory permission substitution is implemented here.

No mock policy store or synthetic canonical identity is introduced. Application
mock mode explicitly requires real canonical BE; tests mock HTTP using this same schema.
Runtime needs a backend deploying both canonical Variant and Inventory Control reads.
Permission-design changes remain deferred.

## Versioned replacement (Step 4)

The same route supports PUT with version plus the six full replacement policy fields.
Null thresholds and shelf life clear configuration. UpdateInventoryControlRequest and
StockPolicy.validate require nonnegative thresholds, safetyStock <= reorderPoint when
both configured, expiry with FEFO and LOT/LOT_SERIAL, shelf life only with expiry,
and shelf life 1..36500. Integer inputs additionally respect Java Integer representation.
No UI choices are automatically changed to satisfy these rules; BE remains authoritative.

PUT uses product-products:UPDATE. Product ownership is checked through inventorySku;
PENDING_APPROVAL and DISCONTINUED products cannot update. The service quotes the
inventory-item version, and the repository increments it; FE never increments it.

Editing captures an accepted snapshot/version even while clean. Background reads may
update cache but cannot replace that snapshot/draft. Cancel restores the accepted local
base; a subsequent background response may update read-only state. Success adopts the
validated returned server state and exact version, updating only this policy query.
Outstanding GETs are cancelled around PUT to avoid overwriting its accepted response.

CONFLICT (409) is ambiguous: it covers version mismatch and Product lifecycle refusal.
The UI does not claim it proves another actor changed the version. COUNT_POLICY_CONFLICT
and INVENTORY_POLICY_STOCK_CONFLICT are shown distinctly with backend information.
Explicit reload replaces draft/base only after successful GET. Failure keeps draft,
base version, and original conflict. Retrying Save without reload quotes the same base.
