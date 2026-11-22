"use client";

import { MessageSquareQuote } from "lucide-react";

import { DESIGN_QUOTE_REQUEST_STATUS_LABELS } from "@/constants";

import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useDesignQuoteRequests } from "@/features/design-review/queries";
import { labelOf } from "@/features/design-review/selectors";

import { DetailSection } from "@/components/shared/DetailSection";

/** Yêu cầu báo giá đi kèm — cho người duyệt (Điều phối sản xuất) biết duyệt xong sẽ có báo giá cần lập. */
export function QuoteRequestsPanel({ designId }: { designId: string }) {
  const query = useDesignQuoteRequests(designId);
  return (
    <DetailSection title="Yêu cầu báo giá đi kèm" icon={MessageSquareQuote}>
      {query.isError ? (
        <p className="text-danger text-[0.8125rem]">{designReviewErrorMessage(query.error)}</p>
      ) : !query.data ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>
      ) : query.data.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Khách chưa yêu cầu báo giá.</p>
      ) : (
        <ul className="divide-y divide-(--table-line)">
          {query.data.map((request) => (
            <li key={request.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-[0.8125rem]">
              <span className="text-ink-primary font-medium tabular-nums">
                {formatNumber(request.cartons)} thùng
              </span>
              <span className="text-ink-secondary">
                Giao mong muốn:{" "}
                {request.desiredDeliveryDate ? formatDate(request.desiredDeliveryDate) : "—"}
              </span>
              <span className="text-ink-secondary">
                {labelOf(DESIGN_QUOTE_REQUEST_STATUS_LABELS, request.status)}
              </span>
              <span className="text-ink-tertiary tabular-nums">
                Yêu cầu lúc {formatDateTime(request.requestedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
