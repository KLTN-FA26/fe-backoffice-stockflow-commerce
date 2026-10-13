"use client";

import { PRODUCTION_ORDER_TYPES } from "@/constants";
import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { TYPE_LABEL } from "./copy";

import type { ProductionOrderType } from "@/constants";

/** Lọc phụ của danh sách LSX: loại (mẫu / đơn) + khoảng hạn giao — giá trị nằm trên URL (nuqs). */
export function ProductionFilters({
  types,
  onTypesChange,
  dueFrom,
  dueTo,
  onDueChange,
}: {
  types: ProductionOrderType[];
  onTypesChange: (types: ProductionOrderType[]) => void;
  dueFrom: string;
  dueTo: string;
  onDueChange: (from: string, to: string) => void;
}) {
  return (
    <div className="bg-bg-subtle border-border-default mb-3 flex flex-wrap items-end gap-3 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">Loại LSX</legend>
        {PRODUCTION_ORDER_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={types.includes(type)}
              onChange={() =>
                onTypesChange(
                  types.includes(type) ? types.filter((value) => value !== type) : [...types, type],
                )
              }
              className="accent-[var(--brand)]"
            />
            {TYPE_LABEL[type]}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2">
        Hạn từ
        <Input
          type="date"
          value={dueFrom}
          onChange={(event) => onDueChange(event.target.value, dueTo)}
          className={`${FORM_INPUT_CLASS} w-40`}
        />
      </label>
      <label className="flex items-center gap-2">
        đến
        <Input
          type="date"
          value={dueTo}
          onChange={(event) => onDueChange(dueFrom, event.target.value)}
          className={`${FORM_INPUT_CLASS} w-40`}
        />
      </label>
    </div>
  );
}
