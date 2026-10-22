"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Truck } from "lucide-react";

import {
  ADMIN_ROUTES,
  LOAD_PLAN_PERMISSIONS,
  PACK_STATUS,
  TRANSFER_DELIVERY_MODE_LABELS,
  UI_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { shortId } from "@/features/fulfillment/selectors";
import { TransferCompleteDialog } from "./TransferCompleteDialog";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const S = UI_LABELS.transferPack.status;
const A = UI_LABELS.transferPack.action;
const BUTTON = "w-full rounded-[var(--r-sm)]";

/**
 * Cột phải: trạng thái phiên, người đóng, hai kho, và thao tác cấp phiên — hoàn tất đóng gói; khi đã đóng xong thì
 * "Lập kế hoạch xe" (cần `fulfillment-load-plans:READ` + `:CREATE`) mở màn lập kế hoạch với lệnh chọn sẵn.
 */
export function TransferPackStatusCard({
  session,
  access,
  actor,
}: {
  session: TransferPackSession;
  access: TransferPackAccess;
  actor: FulfillmentActor;
}) {
  const [completing, setCompleting] = useState(false);
  const warehouses = useWarehouseDirectory().data;
  const nameOf = (id: string) => {
    const warehouse = warehouses?.find((w) => w.warehouseId === id);
    return warehouse
      ? warehouse.code
        ? `${warehouse.code} · ${warehouse.name}`
        : warehouse.name
      : "—";
  };
  const canPlan =
    session.packStatus === PACK_STATUS.PACKED &&
    actor.can(LOAD_PLAN_PERMISSIONS.read) &&
    actor.can(LOAD_PLAN_PERMISSIONS.create);
  const owner = access.isOwner ? S.you : session.packerId ? shortId(session.packerId) : S.waiting;

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <dl className="mb-4 space-y-2 text-[0.8125rem]">
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary">{S.pack}</dt>
          <dd>
            <StatusDot domain="pack" status={session.packStatus} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.deliveryMode}</dt>
          <dd className="text-ink-primary font-medium">
            {TRANSFER_DELIVERY_MODE_LABELS[session.deliveryMode]}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.owner}</dt>
          <dd className="text-ink-primary truncate font-medium">{owner}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.from}</dt>
          <dd className="text-ink-primary truncate">{nameOf(session.fromWarehouseId)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.to}</dt>
          <dd className="text-ink-primary truncate">{nameOf(session.toWarehouseId)}</dd>
        </div>
        {session.startedAt && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-secondary">{S.startedAt}</dt>
            <dd className="text-ink-primary tabular-nums">{formatDateTime(session.startedAt)}</dd>
          </div>
        )}
        {session.packedAt && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-secondary">{S.packedAt}</dt>
            <dd className="text-ink-primary tabular-nums">{formatDateTime(session.packedAt)}</dd>
          </div>
        )}
      </dl>
      <div className="space-y-2">
        {access.canWork && (
          <Button type="button" size="sm" onClick={() => setCompleting(true)} className={BUTTON}>
            <CheckCircle2 className="size-3.5" /> {A.complete}
          </Button>
        )}
        {canPlan && (
          <Button size="sm" asChild className={BUTTON}>
            <Link
              href={ADMIN_ROUTES.loadPlans.createFromTransfer(
                session.transferOrderId,
                session.fromWarehouseId,
              )}
            >
              <Truck className="size-3.5" /> {A.planVehicle}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild className="text-accent w-full">
          <Link href={ADMIN_ROUTES.transfers.detail(session.transferOrderId)}>
            {UI_LABELS.transferPack.openTransfer} <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
      {completing && (
        <TransferCompleteDialog session={session} onClose={() => setCompleting(false)} />
      )}
    </section>
  );
}
