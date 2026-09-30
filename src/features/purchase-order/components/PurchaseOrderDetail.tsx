"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PoActionPanel, actionDescription } from "./detail/PoActionPanel";
import { PoGeneralInfo } from "./detail/PoGeneralInfo";
import { PoLifecycleTimeline } from "./detail/PoLifecycleTimeline";
import { PoLinesTable } from "./detail/PoLinesTable";
import { PoLoadError } from "./detail/PoLoadError";
import { PoOverview } from "./detail/PoOverview";
import { PoReceiveDialog } from "./detail/PoReceiveDialog";
import { PoSupplierWarehouse } from "./detail/PoSupplierWarehouse";
import { PoTotals } from "./detail/PoTotals";
import { usePoDetail } from "./detail/usePoDetail";

export function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const d = usePoDetail(id);

  if (d.poQuery.isLoading) return <PageSkeleton variant="detail" />;
  if (!d.po) {
    const error = d.poQuery.error instanceof ApiError ? d.poQuery.error : null;
    return <PoLoadError id={id} error={error} onRetry={() => void d.poQuery.refetch()} />;
  }
  const po = d.po;

  return (
    <>
      <PageHeader
        title={po.poNumber}
        subtitle={`Đơn đặt NCC — ${d.supplier?.name ?? po.supplierId}`}
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
      {d.masterDataError && (
        <Alert tone="info" className="mb-5">
          Không tải được tên NCC/kho/SKU (BE chưa có API danh mục) — đang hiển thị mã.
        </Alert>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <PoGeneralInfo po={po} />
            <PoSupplierWarehouse po={po} supplier={d.supplier} warehouse={d.warehouse} />
          </div>
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-4" />
              Dòng hàng (PO Lines)
            </h2>
            <PoLinesTable lines={po.lines} skus={d.skus} />
          </section>
          <PoTotals po={po} />
          <PoLifecycleTimeline status={po.status} />
        </div>
        <div className="space-y-5">
          <PoActionPanel
            status={po.status}
            actions={d.actions}
            isMutating={d.isMutating}
            conflictError={d.conflictError}
            onAction={d.onAction}
          />
          <PoOverview po={po} />
        </div>
      </div>
      <PoReceiveDialog
        open={d.receiveOpen}
        onOpenChange={d.setReceiveOpen}
        po={po}
        isPending={d.isReceiving}
        serverError={d.receiveError}
        onConfirm={d.confirmReceive}
      />
      <ConfirmDialog
        open={d.pendingAction !== null}
        onOpenChange={(open) => !open && d.closeReasonDialog()}
        title={d.pendingAction?.label ?? "Xác nhận"}
        description={d.pendingAction ? actionDescription(d.pendingAction, po.status) : ""}
        confirmLabel={d.pendingAction?.label ?? "Xác nhận"}
        variant="danger"
        requireReason
        reasonLabel="Lý do (bắt buộc)"
        onConfirm={(reason) => d.confirmReason(reason ?? "")}
      />
    </>
  );
}
