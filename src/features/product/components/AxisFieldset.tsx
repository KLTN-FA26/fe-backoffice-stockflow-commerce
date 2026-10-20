"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

import { ProductSelectTrigger } from "./form-controls";

import type { Attribute, AttributeValue } from "../attribute-schemas";
import type { AxisDraft } from "../axes-draft";

const L = UI_LABELS.product.axes;

const orderValues = (values: readonly AttributeValue[]) =>
  [...values].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

/** Một trục trong `AxesPicker`: chọn thuộc tính, đổi thứ tự, gỡ trục và tick các giá trị. */
export function AxisFieldset({
  index,
  count,
  axis,
  attribute,
  pickable,
  structureLocked,
  usedValueIds,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  axis: AxisDraft;
  attribute: Attribute | undefined;
  /** Thuộc tính chọn được cho trục này (gồm thuộc tính hiện tại). */
  pickable: readonly Attribute[];
  structureLocked: boolean;
  usedValueIds: ReadonlySet<string>;
  onChange: (patch: Partial<AxisDraft>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const axisUsed = attribute?.values.some((v) => usedValueIds.has(v.valueId)) ?? false;
  const values = orderValues(attribute?.values ?? []).filter(
    (v) => v.active || axis.optionValueIds.includes(v.valueId),
  );
  return (
    <fieldset className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3">
      <div className="flex items-center gap-2">
        <Select
          value={axis.attributeId}
          // Đổi thuộc tính của trục thì bỏ các giá trị đã chọn (thuộc thuộc tính cũ).
          onValueChange={(attributeId) => onChange({ attributeId, optionValueIds: [] })}
          disabled={structureLocked}
        >
          <ProductSelectTrigger aria-label={`Thuộc tính của trục ${index + 1}`} className="flex-1">
            <SelectValue placeholder="Chọn thuộc tính" />
          </ProductSelectTrigger>
          <SelectContent>
            {pickable.map((a) => (
              <SelectItem key={a.attributeId} value={a.attributeId}>
                {a.name} ({a.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Đưa trục lên"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Đưa trục xuống"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Gỡ trục"
          disabled={structureLocked || axisUsed}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {axisUsed && <p className="text-ink-tertiary text-xs">{L.axisInUse}</p>}
      {attribute && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {values.length === 0 && (
            <span className="text-warning text-xs">
              Thuộc tính này chưa có giá trị đang dùng — thêm giá trị ở màn Thuộc tính.
            </span>
          )}
          {values.map((v) => {
            const checked = axis.optionValueIds.includes(v.valueId);
            const used = usedValueIds.has(v.valueId);
            return (
              <label
                key={v.valueId}
                className="text-ink-secondary flex items-center gap-1.5 text-xs"
                title={used ? "Đang có biến thể dùng giá trị này" : undefined}
              >
                <input
                  type="checkbox"
                  className="accent-brand size-3.5"
                  checked={checked}
                  disabled={used && checked}
                  onChange={(e) =>
                    onChange({
                      optionValueIds: e.target.checked
                        ? [...axis.optionValueIds, v.valueId]
                        : axis.optionValueIds.filter((id) => id !== v.valueId),
                    })
                  }
                />
                {v.hexColor && (
                  <span
                    className="border-border-default size-3 rounded-full border"
                    style={{ backgroundColor: v.hexColor }}
                  />
                )}
                {v.label}
                {!v.active && <span className="text-ink-tertiary">(đã vô hiệu)</span>}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
