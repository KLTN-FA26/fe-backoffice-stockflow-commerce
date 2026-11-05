"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { formatDateTime } from "@/lib/format/date";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { useAdjustment } from "../queries";
import { adjustmentReasonLabel, formatSignedQuantity } from "../selectors";
import { AdjustmentActions } from "./AdjustmentActions";
import { InventoryError, InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

export function AdjustmentDetail({ id }: { id: string }) {
  return (
    <InventoryPermissionGate
      allOf={[INVENTORY_PERMISSIONS.adjustmentViewPage, INVENTORY_PERMISSIONS.adjustmentRead]}
    >
      <AdjustmentDetailContent id={id} />
    </InventoryPermissionGate>
  );
}

function AdjustmentDetailContent({ id }: { id: string }) {
  const query = useAdjustment(id);
  if (query.isLoading) return <PageSkeleton variant="detail" />;
  if (query.isError)
    return <InventoryError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  const item = query.data;
  const evidence = [
    // Trang chi tiết không có tiêu đề — mã phiếu nằm ở đầu khối thông tin
    [INVENTORY_LABELS.adjustmentNumber, item.number],
    [INVENTORY_LABELS.sku, item.sku],
    [INVENTORY_LABELS.location, item.locationCode],
    [INVENTORY_LABELS.lot, item.lotNumber],
    [INVENTORY_LABELS.quantityDelta, formatSignedQuantity(item.quantityDelta)],
    [INVENTORY_LABELS.reason, adjustmentReasonLabel(item.reason)],
    [INVENTORY_LABELS.note, item.note],
    [INVENTORY_LABELS.requestedBy, item.requestedBy],
    [INVENTORY_LABELS.requestedAt, formatDateTime(item.requestedAt)],
    [INVENTORY_LABELS.decidedBy, item.decidedBy],
    [INVENTORY_LABELS.decidedAt, item.decidedAt ? formatDateTime(item.decidedAt) : null],
    [INVENTORY_LABELS.postedAt, item.postedAt ? formatDateTime(item.postedAt) : null],
    [INVENTORY_LABELS.withdrawnAt, item.withdrawnAt ? formatDateTime(item.withdrawnAt) : null],
    [INVENTORY_LABELS.rejectionReason, item.rejectionReason],
  ] as const;
  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có link về danh sách; h1 giữ cho screen reader.
    <div
      className="surface-soft surface-compact space-y-[var(--card-pad)]"
      aria-busy={query.isFetching}
    >
      <h1 className="sr-only">{item.number}</h1>
      <InventoryOffline />
      <StatusDot domain="stock" status={item.status} />
      <dl className="border-border-default bg-bg-surface grid grid-cols-1 gap-[var(--card-pad)] rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow) md:grid-cols-2">
        {evidence.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-secondary text-sm">{label}</dt>
            <dd className="break-words tabular-nums">{value ?? INVENTORY_LABELS.missing}</dd>
          </div>
        ))}
      </dl>
      <AdjustmentActions adjustment={item} />
    </div>
  );
}
