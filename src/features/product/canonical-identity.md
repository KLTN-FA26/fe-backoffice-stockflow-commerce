# Canonical Product/Variant reads

Source contract: BE `feature/legacy-tables-removal` at
`8ea4ca156643dfaee8541e8f4ce16b720a7dc56f` (`ProductVariantController`,
`VariantResponse`, `VariantJpaEntity`, Jackson `non_null`). These reads are not
available on audited BE develop `11320add6d20a0088ca364bd97c28758ac2f07b8`.

The additive `/admin/products/{productId}/skus/{variantId}` route restores identity
from URL UUIDs using the direct variant read. The API boundary rejects mismatched
Product/Variant pairs before caching/presentation. SKU code is response data, never
a UUID alias. Paginated lists retain all server metadata and are not resolvers.

Canonical Product read parsing also accepts the confirmed PIM response. Existing
Product writes retain their legacy contracts; this is not a complete Product CRUD
migration. Product images absent from that response are not fetched for identity.

The legacy `/admin/products/sku/{id}`, `SkuDetail`, and Procurement mock persistence
remain unchanged. A canonical Variant is not converted to a legacy Sku, and this
shell does not fabricate price, stock, barcode or Procurement data.

Application mock mode explicitly reports that canonical reads need the real API;
it does not synthesize identity records. Tests mock the confirmed HTTP response
shape only. Reads use the existing `product-products:READ` resource through the
permission checker. No Inventory Control API, query, policy, mutation or UI is
implemented here.
