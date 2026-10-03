"use client";

import Link from "next/link";
import { Truck } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import { InfoRow } from "./InfoRow";

import type { SupplierRef } from "@/lib/references/supplier-lookup";
import type { PurchaseOrder } from "@/features/purchase-order";

const L = UI_LABELS.purchaseOrder;

/**
 * NCC của PO. Tên/mã tra qua `GET /suppliers/{id}` (BE PO không trả); điều khoản thanh toán và
 * thời gian giao lấy từ chính PO (BE chụp từ NCC lúc tạo đơn — `paymentTermDays`, `leadTimeDays`).
 */
export function PoSupplierInfo({
  po,
  supplier,
  supplierName,
}: {
  po: PurchaseOrder;
  supplier: SupplierRef | null;
  /** Tên NCC, hoặc nhãn "đang tải / không tải được" — không bao giờ là UUID. */
  supplierName: string;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Truck className="text-accent size-4" />
        Nhà cung cấp
      </h2>
      <div>
        <InfoRow label={UI_LABELS.purchaseOrder.supplier}>
          <Link
            href={ADMIN_ROUTES.suppliers.detail(po.supplierId)}
            className="text-accent hover:underline"
          >
            {supplierName}
          </Link>
        </InfoRow>
        <InfoRow label={UI_LABELS.purchaseOrder.supplierCode} value={supplier?.code ?? "—"} mono />
        <InfoRow label={L.paymentTermDays} value={`${po.paymentTermDays} ${L.days}`} />
        <InfoRow label={L.leadTimeDays} value={`${po.leadTimeDays} ${L.days}`} />
        <InfoRow label={UI_LABELS.purchaseOrder.currency} value={po.currency} mono />
      </div>
    </section>
  );
}
