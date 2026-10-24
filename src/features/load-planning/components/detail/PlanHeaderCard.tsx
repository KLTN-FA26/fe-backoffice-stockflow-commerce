import Link from "next/link";

import {
  ADMIN_ROUTES,
  LOAD_PLAN_MODE_LABELS,
  LOAD_PLAN_STATUS_LABELS,
  UI_LABELS,
  VEHICLE_TYPE_KIND_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format";
import { isTransferPlan, loadPlanStatusTone } from "@/features/load-planning/plan-selectors";
import { Card } from "@/components/shared/Card";
import { ToneDot } from "@/components/shared/column-helpers";

import type { ReactNode } from "react";
import type { PlanDetail } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.detail;
const T = UI_LABELS.loadPlan.transfer.detail;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary mt-0.5 text-[0.8125rem] break-words">{children}</dd>
    </div>
  );
}

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : null);

/** "Thông tin chung": mã, trạng thái, kho, chế độ, lô, loại xe, các mốc thời gian và lý do mở lại / huỷ. */
export function PlanHeaderCard({
  plan,
  warehouseLabel,
  destinationLabel,
  actions,
}: {
  plan: PlanDetail;
  warehouseLabel: string;
  /** Kho đích của lệnh chuyển kho (kế hoạch nguồn TRANSFER); không tra được thì "—". */
  destinationLabel?: string;
  /** Hàng nút thao tác ở góc phải. */
  actions: ReactNode;
}) {
  const timeline: [string, string | null][] = [
    [L.createdAt, when(plan.createdAt)],
    [L.calculatedAt, when(plan.calculatedAt)],
    [L.confirmedAt, when(plan.confirmedAt)],
    [L.reopenedAt, when(plan.reopenedAt)],
    [L.dispatchedAt, when(plan.dispatchedAt)],
    [L.cancelledAt, when(plan.cancelledAt)],
  ];
  const reason = plan.cancelReason ?? plan.reopenReason;
  const { transferOrder } = plan;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-primary text-sm font-medium">{L.general}</h2>
          <p className="mt-1 flex items-center gap-3">
            <span className="text-accent font-mono text-base font-medium">{plan.code}</span>
            <ToneDot
              tone={loadPlanStatusTone(plan.status)}
              label={LOAD_PLAN_STATUS_LABELS[plan.status]}
            />
          </p>
        </div>
        {actions}
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={L.warehouse}>{warehouseLabel}</Field>
        <Field label={L.mode}>{LOAD_PLAN_MODE_LABELS[plan.selectionMode]}</Field>
        {isTransferPlan(plan) ? (
          <>
            <Field label={T.source}>{UI_LABELS.loadPlan.source.TRANSFER}</Field>
            <Field label={T.transferOrder}>
              {transferOrder ? (
                <Link
                  href={ADMIN_ROUTES.transfers.detail(transferOrder.transferOrderId)}
                  className="text-accent font-mono hover:underline"
                >
                  {transferOrder.number}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label={T.destination}>{destinationLabel ?? "—"}</Field>
          </>
        ) : (
          <Field label={L.shipments}>
            {plan.shipments.length === 0 ? "—" : plan.shipments.map((s) => s.code).join(", ")}
          </Field>
        )}
        <Field label={L.vehicleTypes}>
          {plan.vehicleTypes.length === 0
            ? "—"
            : plan.vehicleTypes
                .map((t) => `${t.code} (${VEHICLE_TYPE_KIND_LABELS[t.kind]})`)
                .join(", ")}
        </Field>
        {timeline.map(([label, value]) =>
          value ? (
            <Field key={label} label={label}>
              {value}
            </Field>
          ) : null,
        )}
        {reason && <Field label={L.reason}>{reason}</Field>}
        {plan.note && <Field label={L.note}>{plan.note}</Field>}
      </dl>
    </Card>
  );
}
