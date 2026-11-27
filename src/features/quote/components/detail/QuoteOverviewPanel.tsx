"use client";

import { QUOTE_STATUS_LABELS as S } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { isExpired } from "@/features/quote/selectors";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LifecycleSteps, ProfileFact, ProfileFrame } from "@/components/shared/ObjectPage";

import { MONO } from "../copy";
import { QuoteNextStep } from "./QuoteNextStep";

import type { Quote } from "@/features/quote/types";

const DASH = <span className="text-ink-tertiary font-normal">—</span>;

/** Luồng chính (QUOTE_TRANSITIONS): nháp → đã gửi → đã chấp nhận → đã tạo đơn; nhánh rẽ nối thêm làm bước cuối. Nhãn lấy
 * nguyên văn `QUOTE_STATUS_LABELS`. */
const MAIN = [S.DRAFT, S.SENT, S.ACCEPTED, S.CONVERTED];
function lifecycle(status: Quote["status"]): { steps: string[]; current: number } {
  switch (status) {
    case "DRAFT":
      return { steps: MAIN, current: 0 };
    case "SENT":
      return { steps: MAIN, current: 1 };
    case "CHANGES_REQUESTED":
      return { steps: [S.DRAFT, S.SENT, S.CHANGES_REQUESTED], current: 2 };
    case "ACCEPTED":
      return { steps: MAIN, current: 2 };
    case "CONVERTED":
      return { steps: MAIN, current: 3 };
    case "EXPIRED":
      return { steps: [S.DRAFT, S.SENT, S.EXPIRED], current: 2 };
    case "CANCELLED":
      return { steps: [S.DRAFT, S.CANCELLED], current: 1 };
  }
}

/**
 * Khung hồ sơ báo giá (backoffice-erp-ui B11): vòng đời nằm ngang ở đầu khung, 8 thông số, cuối khung là điều khoản và
 * việc tiếp theo. Số báo giá, khách, trạng thái và nút chuyển trạng thái nằm ở header.
 */
export function QuoteOverviewPanel({ quote }: { quote: Quote }) {
  const expired = quote.status === "SENT" && isExpired(quote.validUntil);
  const flow = lifecycle(quote.status);
  return (
    <ProfileFrame
      label="Hồ sơ báo giá"
      head={<LifecycleSteps label="Vòng đời báo giá" steps={flow.steps} current={flow.current} />}
      footer={
        <div className="space-y-3">
          {quote.terms && (
            <div className="space-y-1">
              <p className="text-ink-tertiary text-xs">Điều khoản</p>
              <p className="text-ink-secondary text-[0.8125rem] leading-relaxed whitespace-pre-line">
                {quote.terms}
              </p>
            </div>
          )}
          <QuoteNextStep quote={quote} />
        </div>
      }
    >
      <ProfileFact label="Khách hàng">
        <CustomerName id={quote.customerId} />
      </ProfileFact>
      <ProfileFact label="Bản sửa số">
        <span className={MONO}>{quote.revision}</span>
      </ProfileFact>
      <ProfileFact label="Hiệu lực đến">
        <span className={expired ? "text-danger" : "tabular-nums"}>
          {formatDate(quote.validUntil)}
          {expired ? " — Hết hiệu lực" : ""}
        </span>
      </ProfileFact>
      <ProfileFact label="Ngày giao yêu cầu">
        {quote.requestedDeliveryDate ? formatDate(quote.requestedDeliveryDate) : DASH}
      </ProfileFact>
      <ProfileFact label="Tạo lúc">
        <span className="tabular-nums">{formatDateTime(quote.createdAt)}</span>
      </ProfileFact>
      <ProfileFact label="Gửi khách">
        {quote.sentAt ? <span className="tabular-nums">{formatDateTime(quote.sentAt)}</span> : DASH}
      </ProfileFact>
      <ProfileFact label="Khách phản hồi">
        {quote.respondedAt ? (
          <span className="tabular-nums">{formatDateTime(quote.respondedAt)}</span>
        ) : (
          DASH
        )}
      </ProfileFact>
      <ProfileFact label="Số dòng">
        <span className="tabular-nums">{quote.lines.length}</span>
      </ProfileFact>
    </ProfileFrame>
  );
}
