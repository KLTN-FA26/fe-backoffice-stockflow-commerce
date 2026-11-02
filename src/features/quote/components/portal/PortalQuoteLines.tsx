"use client";

import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { MONO } from "../copy";
import { SampleState, linePrice } from "../detail/QuoteLinesTable";

import type { QuoteLine } from "@/features/quote/types";

/**
 * Dòng báo giá cho khách (Mode B, mobile-first): thẻ thay cho bảng 860px; ẩn mã thiết kế / mẫu
 * nội bộ và câu chữ dành cho Sales.
 */
export function PortalQuoteLines({
  lines,
  currency = "VND",
}: {
  lines: QuoteLine[];
  currency?: string;
}) {
  return (
    <ul aria-label="Các dòng của báo giá" className="space-y-3">
      {lines.map((line) => {
        const { unit, total, quantity } = linePrice(line);
        return (
          <li
            key={line.id}
            className="bg-bg-surface border-border-default space-y-2 rounded-[var(--r-lg)] border p-5 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={`font-semibold ${MONO}`}>{line.blankSku}</span>
              <SampleState line={line} />
            </div>
            {line.printSpec && (
              <p className="text-ink-secondary whitespace-pre-line">{line.printSpec}</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-ink-tertiary">Số lượng</dt>
              <dd className={`text-right ${MONO}`}>{formatNumber(quantity)} cái</dd>
              <dt className="text-ink-tertiary">Đơn giá</dt>
              <dd className={`text-right ${MONO}`}>
                {unit != null ? formatMoney(unit, currency) : "Chưa có giá"}
              </dd>
              <dt className="text-ink-tertiary">Thành tiền</dt>
              <dd className={`text-right font-semibold ${MONO}`}>
                {total != null ? formatMoney(total, currency) : "—"}
              </dd>
            </dl>
            {line.priced && line.tiers.length > 1 && (
              <p className="text-ink-secondary">
                Bậc giá:{" "}
                {line.tiers
                  .map(
                    (tier) =>
                      `từ ${formatNumber(tier.minQuantity)} cái ${formatMoney(tier.unitPrice, currency)}`,
                  )
                  .join(" · ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
