"use client";

import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import { ADMIN_ROUTES, PO_PERMISSIONS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PoActionPanel } from "./detail/PoActionPanel";
import { PoDeliveryCard } from "./detail/PoDeliveryCard";
import { PoDetailDialogs } from "./detail/PoDetailDialogs";
import { PoGeneralInfo } from "./detail/PoGeneralInfo";
import { PoLifecycleTimeline } from "./detail/PoLifecycleTimeline";
import { PoLinesTable } from "./detail/PoLinesTable";
import { PoOverview } from "./detail/PoOverview";
import { PoSupplierInfo } from "./detail/PoSupplierInfo";
import { PoTotals } from "./detail/PoTotals";
import { usePoDetail } from "./detail/usePoDetail";
import { PoLoadError } from "./PoLoadError";
import { PoPermissionGate } from "./PoPermissionGate";

export function PurchaseOrderDetail({ id }: { id: string }) {
  return (
    <PoPermissionGate permissions={[PO_PERMISSIONS.viewPage]}>
      <PurchaseOrderDetailBody id={id} />
    </PoPermissionGate>
  );
}

function PurchaseOrderDetailBody({ id }: { id: string }) {
  const d = usePoDetail(id);

  if (!d.canRead) return <PoLoadError error={null} kind="no-read" />;
  if (d.poQuery.isPending) return <PageSkeleton variant="detail" />;
  if (!d.po) {
    return <PoLoadError error={d.poQuery.error} onRetry={() => void d.poQuery.refetch()} />;
  }
  const po = d.po;
  const supplierName = d.supplierName;

  return (
    <>
      <PageHeader
        title={po.poNumber}
        subtitle={`Đơn đặt NCC — ${supplierName}`}
        actions={
          <Link
            href={ADMIN_ROUTES.purchaseOrders.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại
          </Link>
        }
      />
      {d.isDuplicate && (
        <Alert tone="warning" title="Cảnh báo trùng lặp (BR-PO-003)" className="mb-5">
          PO này có cùng NCC + ngày giao dự kiến + SKU với một đơn mở khác.
        </Alert>
      )}
      {/* min-w-0: cột lưới không giãn theo nội dung (bảng, tên NCC dài) → hết tràn ngang < 1280px. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
            <PoGeneralInfo po={po} />
            <PoSupplierInfo po={po} supplier={d.supplier} supplierName={supplierName} />
          </div>
          <section className="border-border-default bg-bg-surface min-w-0 rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-4" />
              Dòng hàng
            </h2>
            <PoLinesTable lines={po.lines} />
          </section>
          {/* Lịch sử gửi NCC nhiều thông tin → cột chính (rộng) */}
          <PoDeliveryCard po={po} />
          <PoTotals po={po} />
        </div>
        <div className="min-w-0 space-y-5">
          <PoActionPanel
            status={po.status}
            actions={d.actions}
            isMutating={d.isMutating}
            conflictError={d.conflictError}
            onAction={(act) => d.open(act.code)}
          />
          <PoOverview po={po} />
          <PoLifecycleTimeline status={po.status} />
        </div>
      </div>
      <PoDetailDialogs po={po} supplierName={supplierName} a={d} />
    </>
  );
}
