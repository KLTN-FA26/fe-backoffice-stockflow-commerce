"use client";

import { PackageX, ReceiptText, Scissors, Split, Truck } from "lucide-react";

import {
  ORDER_DELIVERY_MODE_LABELS,
  ORDER_DELIVERY_MODE_UI,
  ORDER_HISTORY_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { formatClosureNote, formatHistoryReason } from "../history-reason";
import {
  formatCancellationReason,
  formatRemainderClosedStatusReason,
  remainderClosureReasonLabel,
} from "../selectors";

import { AddressChangeHead } from "./AddressChangeHead";

import type { OrderHistoryEntry } from "../types";

const L = ORDER_HISTORY_LABELS;

function EntryMeta({ entry }: { entry: OrderHistoryEntry }) {
  return (
    <p className="text-ink-tertiary mt-0.5 text-xs">
      <span className="tabular-nums">{formatDateTime(entry.occurredAt)}</span>
      {entry.actorName && (
        <>
          {" · "}
          {L.by} {entry.actorName}
        </>
      )}
    </p>
  );
}

/** Ghi chú của mục đã đổi sang chữ người đọc (mã BE → nhãn tiếng Việt); không có thì `null`. */
export function historyNoteText(entry: OrderHistoryEntry): string | null {
  if (!entry.reason) return null;
  // BE ghi lý do huỷ dạng "CODE: ghi chú" → nhãn tiếng Việt (lý do cũ tự do giữ nguyên)
  // Bước đổi trạng thái do đóng phần còn lại: "REMAINDER_CLOSED_<MÃ>: ghi chú" → nhãn tiếng Việt, không hiện mã thô
  // Bước khác: "CODE" / "CODE: ghi chú" (giữ, gỡ giữ, giao thất bại, trả hàng, chạy đêm…) → nhãn + ghi chú; mã lạ nguyên văn
  const reason =
    entry.kind === "status-change" && entry.to === "Cancelled"
      ? formatCancellationReason(entry.reason)
      : entry.kind === "status-change"
        ? (formatRemainderClosedStatusReason(entry.reason) ?? formatHistoryReason(entry.reason))
        : formatClosureNote(entry.reason);
  return reason;
}

/** Ghi chú của Sales (hoặc lý do / mã của bước đổi trạng thái). Trống thì không hiện. */
function EntryNote({ entry }: { entry: OrderHistoryEntry }) {
  const reason = historyNoteText(entry);
  if (!reason) return null;
  return (
    <p className="text-ink-secondary mt-1 text-[0.8125rem] break-words whitespace-pre-wrap">
      <span className="text-ink-tertiary">{L.noteLabel}: </span>
      {reason}
    </p>
  );
}

export function EntryHead({ entry }: { entry: OrderHistoryEntry }) {
  switch (entry.kind) {
    case "partial-shipment":
      // Quyết định của Sales — nổi bật khác hẳn một bước đổi trạng thái (không có from → to)
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <Split className="text-accent size-3.5" aria-hidden="true" />
          {entry.allowed ? L.partialAllowed : L.partialStopped}
        </span>
      );
    case "remainder-closure": {
      // Sales đóng phần còn lại — mục riêng, kể cả khi trạng thái đơn không đổi (lý do là mã BE → nhãn tiếng Việt)
      const reasonLabel = remainderClosureReasonLabel(entry.reasonCode);
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <Scissors className="text-accent size-3.5" aria-hidden="true" />
          {reasonLabel ? L.remainderClosedWithReason(reasonLabel) : L.remainderClosed}
        </span>
      );
    }
    case "delivery-mode": {
      // Điều phối viên đổi (hoặc chọn lúc release) hình thức giao — BE PR #157, `DELIVERY_MODE_CHANGE`
      const to = ORDER_DELIVERY_MODE_LABELS[entry.mode];
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <Truck className="text-accent size-3.5" aria-hidden="true" />
          {entry.previousMode
            ? ORDER_DELIVERY_MODE_UI.historyChanged(
                ORDER_DELIVERY_MODE_LABELS[entry.previousMode],
                to,
              )
            : ORDER_DELIVERY_MODE_UI.historySet(to)}
        </span>
      );
    }
    case "address-change":
      // Sale đổi địa chỉ giao trước khi dán nhãn (docs 17 BR-16) — địa chỉ cũ → mới
      return <AddressChangeHead from={entry.from} to={entry.to} />;
    case "status-change":
      return (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {entry.from ? (
            <>
              <StatusDot domain="order" status={entry.from} />
              <span aria-label={L.statusMoved} className="text-ink-tertiary">
                →
              </span>
            </>
          ) : (
            <span className="text-ink-secondary">{L.placed}</span>
          )}
          <StatusDot domain="order" status={entry.to} />
        </span>
      );
    case "refund-voided":
      // WF-05 TT-3: phiếu hoàn bị huỷ phải thấy được cùng lý do (ghi chú bên dưới)
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <ReceiptText className="text-accent size-3.5" aria-hidden="true" />
          {L.refundVoided}
        </span>
      );
    case "carton-removal":
      // Kho loại thùng ở trạm kiểm thùng (WF4-F2C): LPN + lý do + đơn đi tiếp theo kiểu giao một phần hay bị treo
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <PackageX className="text-accent size-3.5" aria-hidden="true" />
          {L.cartonRemoved(
            entry.lpn,
            entry.removalReason ? (L.cartonRemovalReasons[entry.removalReason] ?? null) : null,
            entry.continuesPartial,
          )}
        </span>
      );
    case "unknown":
      return <span className="text-ink-secondary">{L.unknownEntry}</span>;
  }
}

/** Mục lịch sử nổi bật (quyết định của Sales / đóng phần còn lại / đổi hình thức giao) khác một bước đổi trạng thái thuần. */
const HIGHLIGHTED_KINDS: readonly OrderHistoryEntry["kind"][] = [
  "partial-shipment",
  "remainder-closure",
  "delivery-mode",
  "address-change",
  "refund-voided",
  "carton-removal",
];

/** Một mục của lịch sử đơn: đầu mục theo loại, ai / khi nào, ghi chú. */
export function OrderHistoryItem({ entry }: { entry: OrderHistoryEntry }) {
  return (
    <li
      data-kind={entry.kind}
      className={`rounded-[var(--r-sm)] border p-3 text-[0.8125rem] ${
        HIGHLIGHTED_KINDS.includes(entry.kind)
          ? "border-accent/40 bg-accent/5"
          : "border-border-default"
      }`}
    >
      <EntryHead entry={entry} />
      <EntryMeta entry={entry} />
      <EntryNote entry={entry} />
    </li>
  );
}
