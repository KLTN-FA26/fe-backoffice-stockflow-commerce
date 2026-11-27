"use client";

import { AlertTriangle } from "lucide-react";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";

import { onTimePercent, warningLabel } from "../selectors";

import type { CreditRequestReview } from "../types";

const DASH = "—";

/**
 * Số liệu để Kế toán xét (BE `review`, chỉ back office): lịch sử trả tiền, đang nợ, hạn mức hiện tại, gợi ý. `warnings`
 * chỉ cảnh báo — không khoá nút Duyệt.
 */
export function ReviewPanel({
  review,
  currency,
}: {
  review: CreditRequestReview;
  currency: string;
}) {
  const money = (amount: number | null | undefined) =>
    amount == null ? DASH : formatMoney(amount, currency);
  const ratio = onTimePercent(review);
  return (
    <DetailPanel title="Số liệu xét duyệt" description="Đọc tại lúc mở trang, không lưu.">
      {review.warnings.length > 0 && (
        <ul className="border-warning/30 bg-warning/5 mb-4 space-y-1 rounded-(--r-sm) border px-3 py-2">
          {review.warnings.map((code) => (
            <li key={code} className="text-ink-primary flex items-center gap-2 text-[0.8125rem]">
              <AlertTriangle className="text-warning size-3.5" aria-hidden="true" />
              {warningLabel(code)}
            </li>
          ))}
        </ul>
      )}
      <FactGrid>
        <Fact label="Hợp đồng đã trả đủ">
          {review.settledContracts}
          <span className="text-ink-tertiary font-normal">
            {" "}
            (cần ≥ {review.minSettledContracts})
          </span>
        </Fact>
        <Fact label="Đợt trả đúng hạn">
          {review.onTimeInstallments} / {review.paidInstallments}
          {ratio && <span className="text-ink-tertiary font-normal"> ({ratio})</span>}
        </Fact>
        <Fact label="Trễ trung bình">
          {review.averageDaysLate == null ? "Chưa trễ" : `${review.averageDaysLate} ngày`}
        </Fact>
        <Fact label="Đã trả 12 tháng qua">{money(review.paidLast12Months)}</Fact>
        <Fact label="Đang nợ">{money(review.outstanding)}</Fact>
        <Fact label="Quá hạn">
          {review.hasOverdue ? money(review.overdueAmount) : "Không"}
          {review.oldestOverdueDueDate && (
            <span className="text-ink-tertiary block font-normal">
              từ {formatDate(review.oldestOverdueDueDate)}
            </span>
          )}
        </Fact>
        <Fact label="Hạn mức hiện tại">
          {review.currentCreditLimit == null ? "Chưa có" : money(review.currentCreditLimit)}
          {review.currentCreditTermDays != null && (
            <span className="text-ink-tertiary font-normal">
              {" "}
              · {review.currentCreditTermDays} ngày
            </span>
          )}
        </Fact>
        <Fact label="Hạn mức gợi ý">
          {money(review.suggestedLimit)}
          <span className="text-ink-tertiary block font-normal">
            = {review.suggestedMonths} tháng tiền trả bình quân
          </span>
        </Fact>
      </FactGrid>
    </DetailPanel>
  );
}
