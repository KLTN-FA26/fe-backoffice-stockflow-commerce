"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";

import type { PoAction, PoStatus } from "@/features/purchase-order";
import { PoActionPanel, actionDescription } from "./detail/PoActionPanel";
import { PoGeneralInfo } from "./detail/PoGeneralInfo";
import { PoLinesTable } from "./detail/PoLinesTable";
import { PoLifecycleTimeline } from "./detail/PoLifecycleTimeline";
import { PoNotFound } from "./detail/PoNotFound";
import { PoOverview } from "./detail/PoOverview";
import { PoRevisions, PoSource } from "./detail/PoRevisions";
import { PoReceiveDialog } from "./detail/PoReceiveDialog";
import { PoSupplierWarehouse } from "./detail/PoSupplierWarehouse";
import { PoTotals } from "./detail/PoTotals";
import { usePoDetail } from "./detail/usePoDetail";

export function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const d = usePoDetail(id);
  const runAction = (act: PoAction, reason?: string) => {
    if (!d.po) return;
    const poId = d.po.poId;
    const onSuccess = () => {
      toast.success(act.label, `PO đã chuyển sang "${act.targetStatus ?? act.code}".`);
      d.setConfirmOpen(false);
      d.setPendingAction(null);
    };
    const onError = (e: { status?: number; code?: string; message: string }) => {
      d.setConfirmOpen(false);
      d.setPendingAction(null);
      if (e.status === 409 && e.code === "INVALID_PURCHASE_ORDER_TRANSITION") {
        d.setConflictError(e.message);
        toast.error("Không thể chuyển trạng thái", e.message);
        return;
      }
      if (e.status === 404) {
        d.setConflictError("Đơn đặt hàng không tồn tại hoặc đã bị xoá.");
        toast.error("Không tìm thấy PO", "Đơn đặt hàng không tồn tại hoặc đã bị xoá.");
        return;
      }
      d.setConflictError(e.message);
      toast.error("Lỗi khi chuyển trạng thái", e.message);
    };
    if (act.code === "approve") d.approvePo.mutate({ id: poId }, { onSuccess, onError });
    else if (act.code === "send") d.sendPo.mutate({ id: poId }, { onSuccess, onError });
    else if (act.code === "cancel")
      d.cancelPo.mutate({ id: poId, reason: reason ?? "" }, { onSuccess, onError });
    else if (act.code === "closeShort")
      d.closeShortPo.mutate({ id: poId, reason: reason ?? "" }, { onSuccess, onError });
  };

  if (d.isLoading) return <PageSkeleton variant="detail" />;
  if (!d.po) return <PoNotFound id={id} />;

  return (
    <>
      <PageHeader
        title={d.po.poNumber}
        subtitle={`Đơn đặt NCC — ${d.supplier?.name ?? d.po.supplierId}`}
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
        <div className="border-warning/30 bg-warning/10 text-warning mb-5 rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
          <div className="font-semibold">Cảnh báo trùng lặp (BR-PO-003)</div>
          <p className="text-ink-secondary mt-1 text-xs">
            PO này có cùng NCC + ngày giao dự kiến + SKU với một đơn mở khác.
          </p>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <PoGeneralInfo po={d.po} />
            <PoSupplierWarehouse
              po={d.po}
              supplier={d.supplier ?? null}
              warehouse={d.warehouse ?? null}
            />
          </div>
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-4" />
              Dòng hàng (PO Lines)
            </h2>
            <PoLinesTable lines={d.po.lines} skus={d.skus as never} />
          </section>
          <PoTotals po={d.po} />
          <PoLifecycleTimeline status={d.po.status as PoStatus} />
          <PoRevisions po={d.po} revisionPo={d.revisionPo} />
        </div>
        <div className="space-y-5">
          <PoActionPanel
            status={d.po.status as string}
            actions={d.actions}
            isMutating={d.isMutating}
            conflictError={d.conflictError}
            onAction={(a) => {
              d.setConflictError(null);
              if (a.code === "receive") {
                d.setReceiveOpen(true);
                return;
              }
              if (a.requiresReason) {
                d.setPendingAction(a);
                d.setConfirmOpen(true);
                return;
              }
              runAction(a);
            }}
          />
          {d.po.fromProposalId && <PoSource fromProposalId={d.po.fromProposalId} />}
          <PoOverview po={d.po} />
        </div>
      </div>
      <PoReceiveDialog
        open={d.receiveOpen}
        onOpenChange={d.setReceiveOpen}
        po={d.po}
        isPending={d.receivePo.isPending}
        onConfirm={(lines) => {
          const poId = d.po?.poId;
          if (!poId) return;
          d.receivePo.mutate(
            { id: poId, lines },
            {
              onSuccess: () => {
                toast.success("Đã ghi nhận nhận hàng");
                d.setReceiveOpen(false);
              },
              onError: (e: unknown) => {
                const err = e as { message?: string };
                toast.error("Không thể nhận hàng", err.message ?? "Vui lòng thử lại.");
              },
            },
          );
        }}
      />
      <ConfirmDialog
        open={d.confirmOpen}
        onOpenChange={d.setConfirmOpen}
        title={d.pendingAction ? d.pendingAction.label : "Xác nhận"}
        description={
          d.pendingAction ? actionDescription(d.pendingAction, d.po.status as string) : ""
        }
        confirmLabel={d.pendingAction ? d.pendingAction.label : "Xác nhận"}
        variant="danger"
        requireReason
        reasonLabel="Lý do (bắt buộc)"
        onConfirm={(r) => {
          if (d.pendingAction) runAction(d.pendingAction, r);
        }}
      />
    </>
  );
}
