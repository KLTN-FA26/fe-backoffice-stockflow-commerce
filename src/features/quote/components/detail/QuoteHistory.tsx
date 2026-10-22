import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";

import { quoteStatusLabel } from "../copy";

import type { QuoteTransition } from "@/features/quote/types";

/** Lịch sử chuyển trạng thái thật từ BE (không cho thêm / sửa mốc bằng tay). */
export function QuoteHistory({ history }: { history: QuoteTransition[] }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Lịch sử</h2>
      {history.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có lịch sử.</p>
      ) : (
        <ol className="border-border-default space-y-3 border-l pl-4">
          {history.map((entry) => (
            <li
              key={`${entry.changedAt}-${entry.toStatus}-${entry.revision}`}
              className="text-[0.8125rem]"
            >
              <div className="text-ink-primary font-medium">
                {entry.fromStatus ? `${quoteStatusLabel(entry.fromStatus)} → ` : "Tạo → "}
                {quoteStatusLabel(entry.toStatus)}
                <span className="text-ink-tertiary ml-2 font-normal">bản {entry.revision}</span>
              </div>
              <div className="text-ink-tertiary tabular-nums">
                {formatDateTime(entry.changedAt)}
              </div>
              {entry.reason && (
                <div className="text-ink-secondary mt-0.5 whitespace-pre-line">{entry.reason}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
