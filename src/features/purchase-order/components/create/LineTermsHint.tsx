import { Fragment } from "react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";

import type { PoLineTerms } from "@/features/purchase-order";

const C = UI_LABELS.purchaseOrder.catalog;

/**
 * Điều khoản danh mục NCC của dòng: MOQ, quy cách đóng gói (docs 02 §4 bước 5, BE BR-PO-001),
 * giá danh mục và thời gian giao. Giá khác tiền tệ PO tô cảnh báo (BR-07 docs 02 §6).
 */
export function LineTermsHint({ terms, poCurrency }: { terms: PoLineTerms; poCurrency: string }) {
  const parts = [
    { key: "moq", text: C.moq(terms.moq), warn: false },
    { key: "pack", text: C.packSize(terms.packSize), warn: false },
    {
      key: "price",
      text: C.catalogPrice(formatMoney(terms.price, terms.currency)),
      warn: terms.currency !== poCurrency,
    },
    { key: "lead", text: C.leadTime(terms.effectiveLeadTimeDays), warn: false },
  ];
  return (
    <p className="text-ink-tertiary mt-1 flex flex-wrap gap-x-1.5 text-[11px] tabular-nums">
      {parts.map((p, i) => (
        <Fragment key={p.key}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span className={cn(p.warn && "text-warning")}>{p.text}</span>
        </Fragment>
      ))}
    </p>
  );
}
