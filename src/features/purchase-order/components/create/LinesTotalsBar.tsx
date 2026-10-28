import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";

import type { Totals } from "./types";

const S = UI_LABELS.purchaseOrder.linesStep;

/** Chân bảng dòng hàng: tạm tính · thuế · tổng (BE PR #71 — tổng = tạm tính + thuế). */
export function LinesTotalsBar({ totals, currency }: { totals: Totals; currency: string }) {
  const items = [
    { key: "subtotal", label: S.subtotal, value: totals.subtotal, strong: false },
    { key: "tax", label: S.tax, value: totals.taxTotal, strong: false },
    {
      key: "total",
      label: UI_LABELS.purchaseOrder.grandTotal,
      value: totals.grandTotal,
      strong: true,
    },
  ];
  return (
    <dl className="border-border-default mt-4 flex flex-wrap justify-end gap-x-6 gap-y-1 border-t pt-3 text-[0.8125rem]">
      {items.map((it) => (
        <div key={it.key} className="flex items-baseline gap-2">
          <dt className={it.strong ? "text-ink-primary font-medium" : "text-ink-secondary"}>
            {it.label}
          </dt>
          <dd
            className={
              it.strong
                ? "text-ink-primary font-[family-name:var(--font-mono)] font-semibold tabular-nums"
                : "text-ink-primary font-[family-name:var(--font-mono)] tabular-nums"
            }
          >
            {formatMoney(it.value, currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
