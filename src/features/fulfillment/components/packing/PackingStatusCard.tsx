"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";

import { ADMIN_ROUTES, FULFILLMENT_PICK_PERMISSIONS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { packingErrorMessage } from "@/features/fulfillment/packing-errors";
import { useStartPacking } from "@/features/fulfillment/packing-mutations";
import { toast } from "@/components/shared/Toast";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { CompleteDialog } from "./CompleteDialog";
import { MONO, taskCode } from "../primitives";
import { ReverifyDialog } from "./ReverifyDialog";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { PackingAccess } from "@/features/fulfillment/packing-lifecycle";
import type { PackingSession } from "@/features/fulfillment/packing-types";

const S = UI_LABELS.packing.status;
const N = UI_LABELS.packing.notice;
const BUTTON = "h-(--action-h) w-full rounded-(--action-radius)";

function noActionText(session: PackingSession, access: PackingAccess): string | null {
  if (session.packStatus === "Packed") return N.readOnlyDone;
  if (session.packStatus === "Cancelled") return N.cancelled;
  if (session.packStatus === "On Hold" && !access.canReverify) return N.holdReadOnly;
  if (!access.canPack && !access.canReverify) return N.viewOnly;
  return null;
}

/**
 * Cột phải: trạng thái phiên, người đóng và các thao tác cấp phiên — nhận đơn, hoàn tất đóng gói,
 * kiểm tra lại thiết kế (flow X-CHK). Nhận đơn chỉ gọi `packing-start`; người khác nhận trước thì BE
 * `PACKING_TAKEN` (quản lý kho thì không), câu báo nêu tên người đang đóng.
 */
export function PackingStatusCard({
  session,
  access,
  actor,
  waitingPick,
}: {
  session: PackingSession;
  access: PackingAccess;
  actor: FulfillmentActor;
  /** Lấy hàng chưa xong (theo task) → chưa nhận đơn đóng gói được, ẩn nút Bắt đầu. */
  waitingPick: boolean;
}) {
  const start = useStartPacking();
  const [dialog, setDialog] = useState<"complete" | "reverify" | null>(null);
  const idle = waitingPick ? N.waitingPick : noActionText(session, access);
  const owner = access.isOwner ? S.you : (session.packerName ?? S.waiting);

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
          <dt className="text-ink-secondary">{S.pack}</dt>
          <dd>
            <StatusDot domain="pack" status={session.packStatus} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-secondary">{S.owner}</dt>
          <dd className="text-ink-primary truncate font-medium">
            {session.packerId ? owner : S.waiting}
          </dd>
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
        {access.canStart && !waitingPick && (
          <Button
            type="button"
            size="sm"
            disabled={start.isPending}
            onClick={() =>
              start.mutate(session.taskId, {
                onError: (error) =>
                  toast.error(packingErrorMessage(error, { packerName: session.packerName })),
              })
            }
            className={BUTTON}
          >
            <PlayCircle className="size-3.5" /> {UI_LABELS.packing.action.start}
          </Button>
        )}
        {access.canWork && (
          <Button type="button" size="sm" onClick={() => setDialog("complete")} className={BUTTON}>
            <CheckCircle2 className="size-3.5" /> {UI_LABELS.packing.action.complete}
          </Button>
        )}
        {access.canReverify && (
          <Button type="button" size="sm" onClick={() => setDialog("reverify")} className={BUTTON}>
            <ShieldCheck className="size-3.5" /> {UI_LABELS.packing.action.reverify}
          </Button>
        )}
        {idle && (waitingPick || (!access.canStart && !access.canWork && !access.canReverify)) && (
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
      {dialog === "reverify" && (
        <ReverifyDialog taskId={session.taskId} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
