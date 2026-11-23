"use client";

import { PauseCircle } from "lucide-react";

import {
  COMPLETION_HOLD_LABELS,
  COMPLETION_HOLD_REASON_LABELS,
  ORDER_PERMISSIONS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import {
  allowedCompletionHoldActions,
  isCompletionHoldApplicable,
} from "../../completion-hold-lifecycle";
import { useCompletionHold } from "../../completion-hold-queries";

import { HoldCompletionAction } from "./HoldCompletionAction";
import { ReleaseCompletionHoldAction } from "./ReleaseCompletionHoldAction";

import type { PermissionCode } from "@/lib/auth";
import type { CompletionHoldGate } from "../../completion-hold-lifecycle";
import type { CompletionHold } from "../../completion-hold-schemas";
import type { Order } from "../../types";

const L = COMPLETION_HOLD_LABELS.card;
const SECTION =
  "border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]";

interface CompletionHoldCardProps {
  order: Pick<Order, "orderId" | "orderNumber"> & CompletionHoldGate;
  can: (code: PermissionCode) => boolean;
}

/**
 * Thẻ "Giữ hoàn tất" trên chi tiết đơn (WF-05 GH-2; BE `GET /orders/{id}/completion-hold`): khi đang giữ hiện lý do, ghi
 * chú, ai / lúc nào giữ và nút "Gỡ giữ"; khi chưa giữ hiện nút "Giữ hoàn tất" cho người có `sales-order-holds:UPDATE`.
 * Đơn đã qua hoàn tất mà không có lần giữ nào đang mở → không hiện. UI-only — Backend phải re-check.
 */
export function CompletionHoldCard({ order, can }: CompletionHoldCardProps) {
  const canRead = can(ORDER_PERMISSIONS.read);
  const query = useCompletionHold(order.orderId, { enabled: canRead });
  if (!canRead || query.isPending) return null;
  if (query.isError) {
    if (!isCompletionHoldApplicable(order)) return null;
    return (
      <section aria-label={L.title} className={SECTION}>
        <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
        <p role="alert" className="text-danger text-xs">
          {L.failed}
        </p>
      </section>
    );
  }
  const hold = query.data;
  const actions = allowedCompletionHoldActions(order, hold, can);
  if (!hold && actions.length === 0) return null;
  return (
    <section aria-label={L.title} className={SECTION}>
      <h2 className="text-ink-primary mb-3 flex items-center gap-1.5 text-[0.9375rem] font-semibold">
        <PauseCircle
          className={`size-3.5 ${hold ? "text-warning" : "text-ink-tertiary"}`}
          aria-hidden="true"
        />
        {L.title}
      </h2>
      {hold ? (
        <HoldDetails hold={hold} />
      ) : (
        <p className="text-ink-secondary text-xs">{L.notHeld}</p>
      )}
      {actions.length > 0 && (
        <div className="mt-3">
          {actions.includes("release") ? (
            <ReleaseCompletionHoldAction order={order} />
          ) : (
            <HoldCompletionAction order={order} />
          )}
        </div>
      )}
    </section>
  );
}

function HoldDetails({ hold }: { hold: CompletionHold }) {
  return (
    <div className="space-y-2">
      <p className="text-warning-ink text-[0.8125rem] font-semibold">{L.held}</p>
      <p className="text-ink-secondary text-xs">{L.heldHint}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-ink-secondary">{L.reason}</dt>
        <dd className="text-ink-primary">{COMPLETION_HOLD_REASON_LABELS[hold.reasonCode]}</dd>
        {hold.note && (
          <>
            <dt className="text-ink-secondary">{L.note}</dt>
            <dd className="text-ink-primary break-words whitespace-pre-wrap">{hold.note}</dd>
          </>
        )}
        <dt className="text-ink-secondary">{L.heldAt}</dt>
        <dd className="text-ink-primary tabular-nums">{formatDateTime(hold.heldAt)}</dd>
        {hold.heldBy && (
          <>
            <dt className="text-ink-secondary">{L.heldBy}</dt>
            {/* BE chỉ trả id người giữ (không có tên) — hiện mã, không đoán tên */}
            <dd className="text-ink-primary truncate font-mono text-xs" title={hold.heldBy}>
              {hold.heldBy}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
