"use client";

import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { formatDateTime } from "@/lib/format/date";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { useAdjustment } from "../queries";
import { AdjustmentActions } from "./AdjustmentActions";
import { InventoryError, InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

export function AdjustmentDetail({ id }: { id: string }) {
  return (
    <InventoryPermissionGate permission={INVENTORY_PERMISSIONS.adjustmentRead}>
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
    [INVENTORY_LABELS.sku, item.sku],
    [INVENTORY_LABELS.location, item.locationCode],
    [INVENTORY_LABELS.lot, item.lotNumber],
    [INVENTORY_LABELS.quantityDelta, item.quantityDelta],
    [INVENTORY_LABELS.reason, item.reason],
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
    <div className="space-y-[var(--card-pad)]" aria-busy={query.isFetching}>
      <PageHeader
        title={item.number}
        subtitle={INVENTORY_LABELS.adjustmentDetail}
        actions={
          <Button className="rounded-[var(--r-sm)]" asChild variant="outline">
            <Link href={INVENTORY_ROUTES.adjustments}>{INVENTORY_LABELS.back}</Link>
          </Button>
        }
      />
      <InventoryOffline />
      <StatusDot domain="stock" status={item.status} />
      <dl className="border-border-default bg-bg-surface grid gap-[var(--card-pad)] rounded-[var(--r-sm)] border p-[var(--card-pad)] md:grid-cols-2">
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
