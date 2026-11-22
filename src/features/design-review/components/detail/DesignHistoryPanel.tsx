"use client";

import { History } from "lucide-react";

import { DESIGN_DECISION_LABELS } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useDesignHistory } from "@/features/design-review/queries";
import { historyNote, labelOf, shortId } from "@/features/design-review/selectors";

import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";

/**
 * Lịch sử quyết định từ BE (mới nhất trước). Người làm hiện mã rút gọn — BE chỉ trả `actorId`. Ghi chú chỉ hiện phần
 * do người gõ (`historyNote`), không hiện chuỗi máy tiếng Anh của BE.
 */
export function DesignHistoryPanel({ designId }: { designId: string }) {
  const query = useDesignHistory(designId);
  return (
    <section className={`${DETAIL_CARD_CLASS} space-y-3`}>
      <DetailCardTitle icon={History}>Lịch sử</DetailCardTitle>
      {query.isError ? (
        <p className="text-danger text-[0.8125rem]">{designReviewErrorMessage(query.error)}</p>
      ) : !query.data ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>
      ) : query.data.items.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có lịch sử.</p>
      ) : (
        <ol className="border-border-default space-y-3 border-l pl-4">
          {query.data.items.map((entry) => {
            const note = historyNote(entry);
            return (
              <li
                key={`${entry.at}-${entry.decision}-${entry.version}`}
                className="text-[0.8125rem]"
              >
                <div className="text-ink-primary font-medium">
                  {labelOf(DESIGN_DECISION_LABELS, entry.decision)}
                </div>
                <div className="text-ink-tertiary tabular-nums">
                  {formatDateTime(entry.at)} · {shortId(entry.actorId)}
                </div>
                {note && (
                  <div className="text-ink-secondary mt-0.5 whitespace-pre-line">{note}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
