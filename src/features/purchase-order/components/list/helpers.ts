import type { SupplierRef } from "@/lib/references/supplier-lookup";
import type { PurchaseOrder } from "@/features/purchase-order";

/** "GOHOAPHAT — Gỗ Hòa Phát"; đang tải / không tra được NCC → "—" (không hiện UUID ra UI). */
export function supplierLabel(
  po: Pick<PurchaseOrder, "supplierId">,
  refs: ReadonlyMap<string, SupplierRef>,
): string {
  const ref = refs.get(po.supplierId);
  return ref ? `${ref.code} — ${ref.name}` : "—";
}

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}
