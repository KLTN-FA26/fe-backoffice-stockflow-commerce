"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";

import { ADMIN_ROUTES, FULFILLMENT_PICK_PERMISSIONS, PACK_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useStartCartonCheck } from "@/features/fulfillment/carton-check-mutations";
import { toast } from "@/components/shared/Toast";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, taskCode } from "../primitives";
import { CompleteDialog } from "./CompleteDialog";

import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";
import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";

const S = UI_LABELS.cartonCheck.status;
const N = UI_LABELS.cartonCheck.notice;
const BUTTON = "h-(--action-h) w-full rounded-(--action-radius)";

function noActionText(session: CartonCheckSession, access: CartonCheckAccess): string | null {
  if (session.status === PACK_STATUS.COMPLETED) return N.readOnlyDone;
  if (session.status === PACK_STATUS.CANCELLED) return N.cancelled;
  if (!access.canPack) return N.viewOnly;
  return null;
}

/**
 * Cột phải: trạng thái phiên, người bắt đầu, đơn đã khoá chưa và các thao tác cấp phiên — bắt đầu, hoàn tất. Bắt đầu chỉ
 * gọi `packing-start`; người khác bắt đầu trước thì BE `PACKING_TAKEN` (quản lý kho thì không), câu báo nêu tên người đó.
 */
export function CartonCheckStatusCard({
  session,
  access,
  actor,
  waitingPick,
}: {
  session: CartonCheckSession;
  access: CartonCheckAccess;
  actor: FulfillmentActor;
  /** Lấy hàng chưa xong (theo task) → chưa bắt đầu kiểm được, ẩn nút Bắt đầu. */
  waitingPick: boolean;
}) {
  const start = useStartCartonCheck();
  const [dialog, setDialog] = useState<"complete" | null>(null);
  const idle = waitingPick ? N.waitingPick : noActionText(session, access);
  const starter = access.isOwner ? S.you : (session.startedByName ?? S.waiting);

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <dl className="mb-4 space-y-2 text-[0.8125rem]">
        {/* Trạm không có tiêu đề — số đơn của phiên nằm ở đây */}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{UI_LABELS.fulfillment.field.order}</dt>
          <dd className={`text-ink-primary truncate font-medium ${MONO}`}>
            {session.orderNumber ?? taskCode(session.taskId)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary">{S.session}</dt>
          <dd>
            <StatusDot domain="pack" status={session.status} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.starter}</dt>
          <dd className="text-ink-primary truncate font-medium">
            {session.startedBy ? starter : S.waiting}
          </dd>
        </div>
        {session.startedAt && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-secondary">{S.startedAt}</dt>
            <dd className="text-ink-primary tabular-nums">{formatDateTime(session.startedAt)}</dd>
          </div>
        )}
        {session.completedAt && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-secondary">{S.completedAt}</dt>
            <dd className="text-ink-primary tabular-nums">{formatDateTime(session.completedAt)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.locked}</dt>
          <dd className="text-ink-primary">{session.orderLocked ? S.lockedYes : S.lockedNo}</dd>
        </div>
      </dl>
      <div className="space-y-2">
        {access.canStart && !waitingPick && (
          <Button
            type="button"
            size="sm"
            disabled={start.isPending}
            onClick={() =>
              start.mutate(session.taskId, {
                onError: (error) =>
                  toast.error(
                    cartonCheckErrorMessage(error, { starterName: session.startedByName }),
                  ),
              })
            }
            className={BUTTON}
          >
            <PlayCircle className="size-3.5" /> {UI_LABELS.cartonCheck.action.start}
          </Button>
        )}
        {access.canWork && (
          <Button type="button" size="sm" onClick={() => setDialog("complete")} className={BUTTON}>
            <CheckCircle2 className="size-3.5" /> {UI_LABELS.cartonCheck.action.complete}
          </Button>
        )}
        {idle && (waitingPick || (!access.canStart && !access.canWork)) && (
          <p className="text-ink-tertiary text-center text-xs">{idle}</p>
        )}
        {actor.can(FULFILLMENT_PICK_PERMISSIONS.viewPage) && (
          <Button variant="ghost" size="sm" asChild className="text-accent w-full">
            <Link href={ADMIN_ROUTES.picking.detail(session.taskId)}>
              {UI_LABELS.fulfillment.action.openPicking} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
      {dialog === "complete" && (
        <CompleteDialog session={session} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
