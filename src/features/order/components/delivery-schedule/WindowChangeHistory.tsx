import { DELIVERY_SCHEDULE_LABELS, WINDOW_CHANGE_REASON_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { formatWindowRange } from "../../delivery-window-rules";

import type { DeliveryWindowChange } from "../../delivery-batch-api";

const L = DELIVERY_SCHEDULE_LABELS;

const reasonLabel = (code: string): string =>
  Object.hasOwn(WINDOW_CHANGE_REASON_LABELS, code)
    ? WINDOW_CHANGE_REASON_LABELS[code as keyof typeof WINDOW_CHANGE_REASON_LABELS]
    : code;

const changerName = (change: DeliveryWindowChange): string => change.changedByName?.trim() ?? "";

/** Bằng chứng là tin nhắn chat: giờ gửi + nội dung khách đã viết — không bao giờ hiện mã tin nhắn. */
function EvidenceMessageLine({ change }: { change: DeliveryWindowChange }) {
  const message = change.evidenceMessage;
  const text = message?.deleted ? undefined : message?.text?.trim();
  const sentAt = message?.sentAt ?? null;
  return (
    <span className="text-ink-tertiary block break-words">
      {sentAt ? L.evidenceMessage(formatDateTime(sentAt)) : L.evidenceMessageGeneric}
      {text ? (
        <span className="text-ink-secondary block">{L.evidenceMessageText(text)}</span>
      ) : message ? (
        <span className="block">
          {message.kind === "ATTACHMENT" && !message.deleted
            ? L.evidenceMessageAttachment
            : L.evidenceMessageGone}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Lịch sử dời cửa sổ của một đợt (docs 17 BR-28): cửa sổ cũ → mới, mã lý do, ghi chú, bằng chứng khách đồng ý (tin nhắn
 * chat hoặc tệp), thời điểm, người dời (tên, BE `changedByName`; thiếu tên thì không hiện — không bao giờ hiện id).
 * Cũ nhất trước như BE trả.
 */
export function WindowChangeHistory({ changes }: { changes: readonly DeliveryWindowChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-ink-tertiary text-xs font-medium">{L.history}</p>
      <ol className="mt-1 space-y-1.5">
        {changes.map((change) => (
          <li key={change.id} className="text-ink-secondary text-xs">
            <span className="text-ink-primary tabular-nums">
              {L.historyEntry(
                formatWindowRange(change.oldStart, change.oldEnd),
                formatWindowRange(change.newStart, change.newEnd),
              )}
            </span>
            {" · "}
            {reasonLabel(change.reason)}
            {change.changedAt && (
              <span className="text-ink-tertiary tabular-nums">
                {" "}
                {L.changedAt(formatDateTime(change.changedAt))}
              </span>
            )}
            {changerName(change) && (
              <span className="text-ink-tertiary">
                {" · "}
                {L.changedBy(changerName(change))}
              </span>
            )}
            {change.note && <span className="block break-words">{change.note}</span>}
            {change.evidenceMessageId && <EvidenceMessageLine change={change} />}
            {change.evidenceFileName && (
              <span className="text-ink-tertiary block break-all">
                {L.evidenceFile(change.evidenceFileName)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
