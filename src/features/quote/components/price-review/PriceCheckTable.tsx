"use client";

import { cn } from "cn";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { formatDecimal } from "@/lib/format";
import { formatMoney } from "@/lib/format/money";

import { MONO } from "../copy";

import type { PriceCheckLine, PriceCheckTier } from "@/features/quote/types";

const S = QUOTE_PRICE_REVIEW_LABELS.section;
const L = QUOTE_PRICE_REVIEW_LABELS;
const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-1.5 align-top";
const NUM = `${TD} text-right ${MONO}`;

/** "12,5%" thấp hơn; số âm = cao hơn giá tham chiếu (không bao giờ cần duyệt). */
function discountText(tier: PriceCheckTier): string {
  if (tier.discountPercent == null) return "—";
  return tier.discountPercent < 0
    ? S.above(formatDecimal(-tier.discountPercent, 2))
    : `${formatDecimal(tier.discountPercent, 2)}%`;
}

/** Dòng cần duyệt lên đầu bảng (bo-09), giữ thứ tự dòng trong mỗi nhóm. */
export function orderedForReview(lines: readonly PriceCheckLine[]): PriceCheckLine[] {
  return [...lines].sort(
    (a, b) => Number(b.needsApproval) - Number(a.needsApproval) || a.lineNo - b.lineNo,
  );
}

/**
 * Bảng kiểm tra giá (14 BR-10): mỗi bậc của mỗi dòng với giá tham chiếu, nguồn ("Giá riêng của khách" / "Giá chuẩn"),
 * phần trăm thấp hơn và có phải duyệt không. Số đọc nguyên từ BE (`priceCheck` của nháp, hoặc `priceReview.lines` lúc
 * gửi duyệt) — FE không tự tính. Bậc cần duyệt được tô và ghi "Cần duyệt" bằng chữ.
 */
export function PriceCheckTable({ lines }: { lines: readonly PriceCheckLine[] }) {
  return (
    <div
      role="region"
      aria-label={S.caption}
      tabIndex={0}
      className="border-border-default bg-bg-surface focus-visible:ring-brand overflow-x-auto rounded-(--section-radius) border focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="w-full min-w-[720px] text-[0.8125rem]">
        <caption className="sr-only">{S.caption}</caption>
        <thead className="bg-bg-subtle text-ink-secondary border-b border-(--table-line) text-left">
          <tr>
            <th scope="col" className={TH}>
              {S.lineHeader}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {S.tierHeader}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {S.priceHeader}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {S.referenceHeader}
            </th>
            <th scope="col" className={TH}>
              {S.sourceHeader}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {S.discountHeader}
            </th>
            <th scope="col" className={TH}>
              {S.statusHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {orderedForReview(lines).flatMap((line) =>
            line.tiers.map((tier, index) => (
              <tr
                key={`${line.lineNo}-${tier.minQuantity}`}
                className={cn(tier.needsApproval && "bg-warning/5")}
              >
                <td className={TD}>
                  {index === 0 && (
                    <>
                      <span className={`text-ink-primary block ${MONO}`}>
                        {line.lineNo}. {line.sku}
                      </span>
                      <span className="text-ink-secondary block text-xs">
                        {S.cartons(line.cartons)}
                      </span>
                    </>
                  )}
                </td>
                <td className={NUM}>≥ {tier.minQuantity}</td>
                <td className={NUM}>{formatMoney(tier.unitPrice, "VND")}</td>
                <td className={NUM}>
                  {tier.referencePrice != null ? formatMoney(tier.referencePrice, "VND") : "—"}
                </td>
                <td className={TD}>
                  {tier.source ? (
                    L.source[tier.source]
                  ) : (
                    <span className="text-ink-tertiary">{L.noReference}</span>
                  )}
                </td>
                <td className={NUM}>{discountText(tier)}</td>
                <td className={TD}>
                  {tier.needsApproval ? (
                    <span className="text-warning-ink font-medium">{S.needsApproval}</span>
                  ) : (
                    <span className="text-ink-secondary">{S.ok}</span>
                  )}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
