"use client";

import { UI_LABELS } from "@/constants";

const L = UI_LABELS.loadPlan.createForm;

/** Một ô "hàng chèn": dòng đơn, nhãn hiện ra và nhãn cho trình đọc màn hình. */
export interface FillLineChoice {
  orderLineId: string;
  label: string;
  ariaLabel: string;
}

/**
 * "Ưu tiên + hàng chèn" (docs 09 §3 "Phân nhóm kiện chính / phụ"; RTM-LPGROUP 19/11): mỗi dòng đơn có một ô "hàng
 * chèn"; dòng không tick là hàng chính. Dùng chung cho kế hoạch (dòng của các lô đã chọn) và ước tính một đơn (dòng của
 * đơn) — chỉ hiện khi chọn chế độ này.
 */
export function FillLinesPicker({
  idPrefix,
  options,
  ticked,
  onToggle,
  emptyText = L.fillEmpty,
}: {
  idPrefix: string;
  options: readonly FillLineChoice[];
  ticked: ReadonlySet<string>;
  onToggle: (orderLineId: string) => void;
  emptyText?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-ink-primary text-sm font-medium">{L.fillTitle}</legend>
      <p className="text-ink-tertiary text-xs">{L.fillHint}</p>
      {options.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{emptyText}</p>
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
                    aria-label={o.ariaLabel}
                    className="accent-brand"
                  />
                  <span className="text-ink-primary">{o.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
