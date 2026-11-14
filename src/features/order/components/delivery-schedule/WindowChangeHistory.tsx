import { DELIVERY_SCHEDULE_LABELS, WINDOW_CHANGE_REASON_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { formatWindowRange } from "../../delivery-window-rules";

import type { DeliveryWindowChange } from "../../delivery-batch-api";

const L = DELIVERY_SCHEDULE_LABELS;

const reasonLabel = (code: string): string =>
  Object.hasOwn(WINDOW_CHANGE_REASON_LABELS, code)
    ? WINDOW_CHANGE_REASON_LABELS[code as keyof typeof WINDOW_CHANGE_REASON_LABELS]
    : code;

/**
 * Lịch sử dời cửa sổ của một đợt (docs 17 BR-28): cửa sổ cũ → mới, mã lý do, ghi chú, bằng chứng khách đồng ý (tin nhắn
 * chat hoặc tệp), thời điểm. Cũ nhất trước như BE trả. Người thực hiện: BE chỉ trả id người dùng (không có tên) nên không
 * hiện.
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
            {change.note && <span className="block break-words">{change.note}</span>}
            {change.evidenceMessageId && (
              <span className="text-ink-tertiary block break-all">
                {L.evidenceMessage(change.evidenceMessageId)}
              </span>
            )}
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
