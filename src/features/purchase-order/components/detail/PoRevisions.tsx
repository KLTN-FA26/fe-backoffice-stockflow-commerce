"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ADMIN_ROUTES } from "@/constants";
import type { PurchaseOrder } from "@/features/purchase-order";

export function PoRevisions({
  po,
  revisionPo,
}: {
  po: PurchaseOrder;
  revisionPo: PurchaseOrder | null;
}) {
  return (
    <>
      {po.revisionOf && (
        <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
            <RefreshCw className="text-accent size-4" />
            PO Revision
          </h2>
          <p className="text-ink-secondary text-[0.8125rem]">
            Đây là bản sửa đổi của PO{" "}
            <Link
              href={ADMIN_ROUTES.purchaseOrders.detail(po.revisionOf)}
              className="text-accent font-[family-name:var(--font-mono)] font-medium hover:underline"
            >
              {po.revisionOf}
            </Link>
            .
          </p>
        </section>
      )}
      {revisionPo && (
        <section className="border-warning/30 bg-warning/5 rounded-[var(--card-radius)] border p-[var(--card-pad)]">
          <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
            <RefreshCw className="text-warning size-4" />
            Đã thay thế
          </h2>
          <p className="text-ink-secondary text-[0.8125rem]">
            PO này đã được thay thế bởi PO{" "}
            <Link
              href={ADMIN_ROUTES.purchaseOrders.detail(revisionPo.poId)}
              className="text-accent font-[family-name:var(--font-mono)] font-medium hover:underline"
            >
              {revisionPo.poNumber}
            </Link>
            .
          </p>
        </section>
      )}
    </>
  );
}

export function PoSource({ fromProposalId }: { fromProposalId: string }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">Nguồn gốc</h2>
      <p className="text-ink-secondary text-[0.8125rem]">
        Từ đề xuất nhập hàng:{" "}
        <Link
          href={ADMIN_ROUTES.replenishment.list}
          className="text-accent font-[family-name:var(--font-mono)] font-medium hover:underline"
        >
          {fromProposalId}
        </Link>
      </p>
    </section>
  );
}
