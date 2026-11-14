import { CANCELLATION_REQUEST_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { cancellationRequestDisplayStatus } from "../../cancellation-request-schemas";
import { cancellationReasonLabel } from "../../selectors";

import type { CancellationRequest } from "../../cancellation-request-schemas";

const L = CANCELLATION_REQUEST_LABELS.card;

/**
 * Một yêu cầu huỷ của khách: trạng thái (docs 17 §5.4), lý do + ghi chú khách nêu, thời điểm gửi, và — khi đã quyết —
 * ghi chú quyết định + phần trăm giữ lại. Chỉ hiển thị dữ liệu BE trả, không suy diễn.
 */
export function CancellationRequestSummary({ request }: { request: CancellationRequest }) {
  return (
    <div className="space-y-1.5 text-[0.8125rem]">
      <div className="flex items-center justify-between gap-2">
        <StatusDot domain="order" status={cancellationRequestDisplayStatus(request.status)} />
        <span className="text-ink-tertiary text-xs tabular-nums">
          {L.requestedAt(formatDateTime(request.requestedAt))}
        </span>
      </div>
      <p className="text-ink-primary font-medium">{cancellationReasonLabel(request.reasonCode)}</p>
      {request.note && (
        <p className="text-ink-secondary break-words">
          <span className="text-ink-tertiary">{L.customerNote}: </span>
          {request.note}
        </p>
      )}
      {request.decisionNote && (
        <p className="text-ink-secondary break-words">
          <span className="text-ink-tertiary">{L.decisionNote}: </span>
          {request.decisionNote}
        </p>
      )}
      {request.retainedPercent !== null && request.retainedPercent > 0 && (
        <p className="text-ink-secondary tabular-nums">
          {L.retained(String(request.retainedPercent))}
        </p>
      )}
      {request.decidedAt && (
        <p className="text-ink-tertiary text-xs tabular-nums">
          {L.decidedAt(formatDateTime(request.decidedAt))}
        </p>
      )}
    </div>
  );
}
