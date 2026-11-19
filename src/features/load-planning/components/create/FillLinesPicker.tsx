"use client";

import { UI_LABELS } from "@/constants";

import type { FillLineOption } from "@/features/load-planning/plan-selectors";

const L = UI_LABELS.loadPlan.createForm;

/**
 * "Ưu tiên + hàng chèn" (docs 09 §3 "Phân nhóm kiện chính / phụ"; RTM-LPGROUP 19/11): mỗi dòng đơn của các lô đã chọn có
 * một ô "hàng chèn"; dòng không tick là hàng chính. Chỉ hiện khi chọn chế độ này.
 */
export function FillLinesPicker({
  idPrefix,
  options,
  ticked,
  onToggle,
}: {
  idPrefix: string;
  options: readonly FillLineOption[];
  ticked: ReadonlySet<string>;
  onToggle: (orderLineId: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-ink-primary text-sm font-medium">{L.fillTitle}</legend>
      <p className="text-ink-tertiary text-xs">{L.fillHint}</p>
      {options.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{L.fillEmpty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const id = `${idPrefix}-fill-${o.orderLineId}`;
            return (
              <li key={o.orderLineId}>
                <label
                  htmlFor={id}
                  className="border-border-default bg-bg-surface hover:bg-bg-subtle has-[:checked]:border-brand flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border p-2.5 text-[0.8125rem]"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={ticked.has(o.orderLineId)}
                    onChange={() => onToggle(o.orderLineId)}
                    aria-label={L.fillAria(o.shipmentCode, o.sku)}
                    className="accent-brand"
                  />
                  <span className="text-ink-primary">
                    {L.fillLine(o.shipmentCode, o.sku, o.packages)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
