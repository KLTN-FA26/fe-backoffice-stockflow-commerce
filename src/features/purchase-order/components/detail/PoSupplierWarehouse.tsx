"use client";

import { Truck } from "lucide-react";

import type { PurchaseOrder } from "@/features/purchase-order";
import { InfoRow } from "./InfoRow";

export function PoSupplierWarehouse({
  po,
  supplier,
  warehouse,
}: {
  po: PurchaseOrder;
  supplier: { name: string; paymentTerms?: string } | null;
  warehouse: { name: string } | null;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Truck className="text-accent size-4" />
        Nhà cung cấp &amp; Kho
      </h2>
      <div>
        <InfoRow label="NCC" value={supplier?.name ?? po.supplierId} />
        <InfoRow label="Mã NCC" value={po.supplierId} mono />
        <InfoRow label="Điều khoản" value={supplier?.paymentTerms ?? "—"} />
        <InfoRow label="Đơn vị tiền tệ" value={po.currency} />
        <InfoRow label="Kho nhận" value={warehouse?.name ?? po.warehouseId} />
        <InfoRow label="Mã kho" value={po.warehouseId} mono />
      </div>
    </section>
  );
}
