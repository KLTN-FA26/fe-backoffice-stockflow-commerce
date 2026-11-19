"use client";

import { Calculator } from "lucide-react";

import { QUOTE_FEE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { displayTotals } from "@/features/quote/selectors";
import { DetailSection } from "@/components/shared/DetailSection";

import { MONO } from "../copy";

import type { Quote } from "@/features/quote/types";

/** Bảng phí + tổng (chưa thuế / thuế / có thuế) — số của BE (`proposed` hoặc `accepted`). */
export function QuoteFeesTotals({ quote }: { quote: Quote }) {
  const totals = displayTotals(quote);
  return (
    <DetailSection title="Phí & tổng" icon={Calculator}>
      {quote.fees.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Không có phí.</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">Các dòng phí</caption>
          <tbody className="divide-y divide-[var(--table-line)]">
            {quote.fees.map((fee) => (
              <tr key={fee.id}>
                <th scope="row" className="text-ink-secondary py-1.5 text-left font-normal">
                  {QUOTE_FEE_LABELS[fee.kind]}
                  {fee.sku && <span className={`ml-1 ${MONO}`}>{fee.sku}</span>}
                </th>
                <td className={`py-1.5 text-right ${MONO}`}>
                  {fee.amount != null ? (
                    formatMoney(fee.amount, "VND")
                  ) : (
                    <span className="text-warning">Chưa nhập</span>
                  )}
                </td>
                <td className={`text-ink-tertiary py-1.5 pl-3 text-right ${MONO}`}>
                  {fee.taxRate != null ? `VAT ${fee.taxRate}%` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-(--table-line) pt-3 text-[0.8125rem]">
        {totals ? (
          <>
            <dt className="text-ink-tertiary">Tiền hàng</dt>
            <dd className={MONO}>{formatMoney(totals.subtotal, "VND")}</dd>
            <dt className="text-ink-tertiary">Phí</dt>
            <dd className={MONO}>{formatMoney(totals.fees, "VND")}</dd>
            <dt className="text-ink-tertiary">Thuế</dt>
            <dd className={MONO}>{formatMoney(totals.tax, "VND")}</dd>
            <dt className="text-ink-primary font-semibold">
              {quote.accepted ? "Tổng đã chấp nhận (có thuế)" : "Tổng có thuế"}
            </dt>
            <dd className={`text-ink-primary font-semibold ${MONO}`}>
              {formatMoney(totals.total, "VND")}
            </dd>
          </>
        ) : (
          <dd className="text-ink-tertiary col-span-2">Chưa đủ giá các dòng / phí để tính tổng.</dd>
        )}
      </dl>
    </DetailSection>
  );
}
