"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "cn";
import {
  ArrowLeft,
  FileText,
  Package,
  Truck,
  ClipboardCheck,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE, PO_STATUS } from "@/constants";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  allowedPoActions,
  formatMoney,
  openQuantity,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrder,
  usePurchaseOrders,
  useApprovePo,
  useSendPo,
  useCancelPo,
  useCloseShortPo,
} from "@/features/purchase-order";
import { useSkus } from "@/features/product";

import type { PoAction, PoLine, PoStatus } from "@/features/purchase-order";

/** BE 7-state lifecycle — no Pending Approval/Confirmed/Received (BE simplified scope). */
const PO_LIFECYCLE: PoStatus[] = [
  PO_STATUS.DRAFT,
  PO_STATUS.APPROVED,
  PO_STATUS.SENT,
  PO_STATUS.PARTIALLY_RECEIVED,
  PO_STATUS.CLOSED,
];

function getLifecycleSteps(status: PoStatus) {
  if (status === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((step) => ({ label: step as string, done: false, current: false }));
  }
  if (status === PO_STATUS.CLOSED_SHORT) {
    // Closed-short branches off PARTIALLY_RECEIVED — show linear up to it
    return [...PO_LIFECYCLE, PO_STATUS.CLOSED_SHORT].map((step) => ({
      label: step as string,
      done: step !== PO_STATUS.CLOSED,
      current: step === PO_STATUS.CLOSED_SHORT,
    }));
  }
  const idx = PO_LIFECYCLE.indexOf(status);
  if (idx === -1)
    return PO_LIFECYCLE.map((s) => ({ label: s as string, done: false, current: false }));
  return PO_LIFECYCLE.map((step, i) => ({
    label: step as string,
    done: i <= idx,
    current: i === idx,
  }));
}

function InfoRow({
  label,
  value,
  mono,
  danger,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border-default flex items-baseline justify-between border-b py-2 last:border-b-0">
      <span className="text-ink-tertiary text-xs font-medium">{label}</span>
      {children ? (
        <span className="text-ink-primary text-[0.8125rem]">{children}</span>
      ) : (
        <span
          className={cn(
            "text-[0.8125rem]",
            danger ? "text-danger font-medium" : "text-ink-primary",
            mono && "font-[family-name:var(--font-mono)] tabular-nums",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const searchParams = useSearchParams();
  const isDuplicate = searchParams.get("duplicate") === "1";
  const roles = useAuthStore((state) => state.effectiveRoles());
  const currentRole = roles[0];

  const poQuery = usePurchaseOrder(id);
  const purchaseOrdersQuery = usePurchaseOrders({ page: 1, pageSize: PAGE_SIZE.masterData });
  const suppliersQuery = usePoSuppliers({});
  const warehousesQuery = usePoWarehouses({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });

  const po = poQuery.data ?? null;
  const purchaseOrders = useMemo(
    () => purchaseOrdersQuery.data?.items ?? [],
    [purchaseOrdersQuery.data],
  );
  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const isLoading =
    poQuery.isLoading ||
    purchaseOrdersQuery.isLoading ||
    suppliersQuery.isLoading ||
    warehousesQuery.isLoading ||
    skusQuery.isLoading;

  const supplier = useMemo(
    () => (po ? suppliers.find((s) => s.supplierId === po.supplierId) : null),
    [po, suppliers],
  );
  const warehouse = useMemo(
    () => (po ? warehouses.find((w) => w.warehouseId === po.warehouseId) : null),
    [po, warehouses],
  );

  const lifecycleSteps = useMemo(() => (po ? getLifecycleSteps(po.status) : []), [po]);
  const actions = po && currentRole ? allowedPoActions(po.status, currentRole) : [];
  const revisionPo = useMemo(
    () => (po ? (purchaseOrders.find((p) => p.revisionOf === po.poId) ?? null) : null),
    [po, purchaseOrders],
  );

  const approvePo = useApprovePo();
  const sendPo = useSendPo();
  const cancelPo = useCancelPo();
  const closeShortPo = useCloseShortPo();
  const isMutating =
    approvePo.isPending || sendPo.isPending || cancelPo.isPending || closeShortPo.isPending;

  const [pendingAction, setPendingAction] = useState<PoAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const handleAction = (act: PoAction) => {
    setConflictError(null);
    if (act.requiresReason) {
      setPendingAction(act);
      setConfirmOpen(true);
      return;
    }
    runAction(act, undefined);
  };

  const runAction = (act: PoAction, reason?: string) => {
    if (!po) return;
    const onSuccess = () => {
      toast.success(act.label, `PO đã chuyển sang "${act.targetStatus ?? act.code}".`);
      setConfirmOpen(false);
      setPendingAction(null);
    };
    const onError = (error: { status?: number; code?: string; message: string }) => {
      setConfirmOpen(false);
      setPendingAction(null);
      if (error.status === 409 && error.code === "INVALID_PURCHASE_ORDER_TRANSITION") {
        setConflictError(error.message);
        toast.error("Không thể chuyển trạng thái", error.message);
        return;
      }
      if (error.status === 404) {
        setConflictError("Đơn đặt hàng không tồn tại hoặc đã bị xoá.");
        toast.error("Không tìm thấy PO", "Đơn đặt hàng không tồn tại hoặc đã bị xoá.");
        return;
      }
      setConflictError(error.message);
      toast.error("Lỗi khi chuyển trạng thái", error.message);
    };
    if (act.code === "approve") approvePo.mutate({ id: po.poId }, { onSuccess, onError });
    else if (act.code === "send") sendPo.mutate({ id: po.poId }, { onSuccess, onError });
    else if (act.code === "cancel")
      cancelPo.mutate({ id: po.poId, reason: reason ?? "" }, { onSuccess, onError });
    else if (act.code === "closeShort")
      closeShortPo.mutate({ id: po.poId, reason: reason ?? "" }, { onSuccess, onError });
  };

  const handleConfirm = (reason?: string) => {
    if (!pendingAction) return;
    runAction(pendingAction, reason);
  };

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (!po) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy PO"
          subtitle="Đơn đặt NCC không tồn tại hoặc đã bị xoá."
        />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <FileText className="mb-3 size-12 opacity-40" />
          <p className="text-[0.9375rem]">
            Đơn đặt hàng{" "}
            <code className="text-accent font-[family-name:var(--font-mono)]">{id}</code> không tồn
            tại.
          </p>
          <Link
            href={ADMIN_ROUTES.purchaseOrders.list}
            className="text-accent mt-4 text-[0.8125rem] hover:underline"
          >
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const lineColumns: ColumnDef<PoLine>[] = [
    {
      key: "skuId",
      header: "Mã SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      cell: (row) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {row.skuId}
        </span>
      ),
    },
    {
      key: "skuName",
      header: "Tên SKU",
      cell: (row) => (
        <span className="text-ink-primary text-[0.8125rem]">
          {skus.find((s) => s.skuId === row.skuId)?.variantLabel ?? row.skuId}
        </span>
      ),
    },
    {
      key: "orderedQty",
      header: "SL đặt",
      align: "right",
      sortable: true,
      compare: (a, b) => a.orderedQty - b.orderedQty,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {row.orderedQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "unitPrice",
      header: "Đơn giá",
      align: "right",
      sortable: true,
      compare: (a, b) => a.unitPrice - b.unitPrice,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(row.unitPrice, row.currency)}
        </span>
      ),
    },
    {
      key: "receivedQty",
      header: "SL đã nhận",
      align: "right",
      sortable: true,
      compare: (a, b) => a.receivedQty - b.receivedQty,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {row.receivedQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "openQty",
      header: "Open qty",
      align: "right",
      sortable: true,
      compare: (a, b) => openQuantity(a) - openQuantity(b),
      cell: (row) => {
        const open = openQuantity(row);
        return (
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums",
              open > 0 ? "text-warning" : "text-ink-primary",
            )}
          >
            {open.toLocaleString("vi-VN")}
          </span>
        );
      },
    },
    {
      key: "lineTotal",
      header: "Thành tiền",
      align: "right",
      sortable: true,
      compare: (a, b) => a.lineTotal - b.lineTotal,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(row.lineTotal, row.currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={po.poNumber}
        subtitle={`Đơn đặt NCC — ${supplier?.name ?? po.supplierId}`}
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

      {isDuplicate && (
        <div className="border-warning/30 bg-warning/10 text-warning mb-5 rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
          <div className="font-semibold">Cảnh báo trùng lặp (BR-PO-003)</div>
          <p className="text-ink-secondary mt-1 text-xs">
            PO này có cùng NCC + ngày giao dự kiến + SKU với một đơn mở khác. Vui lòng rà soát trước
            khi duyệt.
          </p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
              <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
                <FileText className="text-accent size-4" />
                Thông tin chung
              </h2>
              <div>
                <InfoRow label="Số PO" value={po.poNumber} mono />
                <InfoRow label="Trạng thái">
                  <StatusDot domain="po" status={po.status} size="sm" withIcon />
                </InfoRow>
                <InfoRow label="Ngày đặt" value={po.orderDate} mono />
                <InfoRow label="Ngày giao DK" value={po.expectedDate} mono />
                <InfoRow label="Người tạo" value={po.createdBy} />
                <InfoRow label="Người duyệt" value={po.approvedBy ?? "—"} />
                {po.notes && <InfoRow label="Ghi chú" value={po.notes} />}
                {po.rejectionReason && (
                  <InfoRow label="Lý do huỷ/đóng" value={po.rejectionReason} danger />
                )}
              </div>
            </section>

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
          </div>

          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-4" />
              Dòng hàng (PO Lines)
            </h2>
            <DataTable
              data={po.lines}
              columns={lineColumns}
              rowKey={(row) => row.lineId}
              caption={`${po.lines.length} dòng hàng — ${po.poNumber}`}
              pageSize={50}
            />
          </section>

          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <ClipboardCheck className="text-accent size-4" />
              Tổng cộng
            </h2>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Tạm tính</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
                  {formatMoney(po.subtotal, po.currency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Thuế</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
                  {formatMoney(po.taxTotal, po.currency)}
                </span>
              </div>
              <div className="border-border-default flex items-baseline justify-between border-t pt-2 text-[0.9375rem]">
                <span className="text-ink-primary font-semibold">Tổng giá trị</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">
                  {formatMoney(po.grandTotal, po.currency)}
                </span>
              </div>
            </div>
          </section>

          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <CircleDot className="text-accent size-4" />
              Vòng đời PO
            </h2>
            <div className="relative pl-6">
              <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
              {lifecycleSteps.map((step) => (
                <div key={step.label} className="relative pb-5 last:pb-0">
                  <div
                    className={cn(
                      "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                      step.current
                        ? "bg-accent ring-accent/30 ring-2"
                        : step.done
                          ? "bg-positive"
                          : "bg-bg-muted",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[0.8125rem] font-medium",
                        step.current
                          ? "text-accent"
                          : step.done
                            ? "text-ink-primary"
                            : "text-ink-tertiary",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.current && (
                      <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                        Hiện tại
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(po.status as string) === "CANCELLED" && (
                <div className="relative pb-0">
                  <div className="border-bg-surface bg-danger ring-danger/30 absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2 ring-2" />
                  <div className="flex items-center gap-2">
                    <span className="text-danger text-[0.8125rem] font-medium">CANCELLED</span>
                    <span className="bg-danger/10 text-danger rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                      Hiện tại
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

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
        </div>

        <div className="space-y-5">
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <div className="mb-4 flex justify-center">
              <StatusDot domain="po" status={po.status} size="md" withIcon />
            </div>
            {actions.length > 0 && (
              <div className="space-y-2">
                {conflictError && (
                  <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
                    {conflictError}
                  </div>
                )}
                {actions.map((act) => (
                  <Button
                    key={act.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={act.label}
                    disabled={isMutating}
                    onClick={() => handleAction(act)}
                    className={cn(
                      "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                      act.destructive
                        ? "border-danger text-danger hover:bg-danger/10 bg-transparent"
                        : "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
                    )}
                  >
                    {act.label}
                  </Button>
                ))}
              </div>
            )}
            {((po.status as string) === "CLOSED" ||
              (po.status as string) === "CLOSED_SHORT" ||
              (po.status as string) === "CANCELLED") && (
              <p className="text-ink-tertiary text-center text-xs">
                Trạng thái kết thúc — không có hành động khả dụng.
              </p>
            )}
          </section>

          {po.fromProposalId && (
            <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
              <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">Nguồn gốc</h2>
              <p className="text-ink-secondary text-[0.8125rem]">
                Từ đề xuất nhập hàng:{" "}
                <Link
                  href={ADMIN_ROUTES.replenishment.list}
                  className="text-accent font-[family-name:var(--font-mono)] font-medium hover:underline"
                >
                  {po.fromProposalId}
                </Link>
              </p>
            </section>
          )}

          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Dòng hàng</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                  {po.lines.length}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Tổng SL đặt</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                  {totalOrderedQuantity(po).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Tổng SL đã nhận</span>
                <span className="text-positive font-[family-name:var(--font-mono)] font-medium">
                  {totalReceivedQuantity(po).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">SL còn lại</span>
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] font-medium",
                    totalOpenQuantity(po) > 0 ? "text-warning" : "text-ink-primary",
                  )}
                >
                  {totalOpenQuantity(po).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="border-border-default border-t pt-2">
                <div className="flex justify-between text-[0.8125rem]">
                  <span className="text-ink-secondary">Tiền tệ</span>
                  <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                    {po.currency}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[0.8125rem]">
                  <span className="text-ink-primary font-medium">Tổng giá trị</span>
                  <span className="text-ink-primary font-[family-name:var(--font-mono)] font-bold">
                    {formatMoney(po.grandTotal, po.currency)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={pendingAction ? pendingAction.label : "Xác nhận"}
        description={pendingAction ? actionDescription(pendingAction, po.status) : ""}
        confirmLabel={pendingAction ? pendingAction.label : "Xác nhận"}
        variant="danger"
        requireReason
        reasonLabel="Lý do (bắt buộc)"
        onConfirm={handleConfirm}
      />
    </>
  );
}

function actionDescription(act: PoAction, currentStatus: PoStatus): string {
  if (act.code === "cancel")
    return `Huỷ PO — đơn sẽ chuyển sang "CANCELLED" từ "${currentStatus}". Không thể khôi phục.`;
  if (act.code === "closeShort")
    return `Đóng thiếu — PO sẽ chuyển sang "CLOSED_SHORT". Phần còn lại được ghi nhận thiếu.`;
  return `Xác nhận thực hiện "${act.label}".`;
}
