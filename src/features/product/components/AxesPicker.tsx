"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { canBeVariantAxis } from "../attribute-schemas";

import type { Attribute, AttributeValue } from "../attribute-schemas";
import type { AxisDraft } from "../axes-draft";

interface Props {
  /** Từ điển thuộc tính (kèm giá trị). */
  attributes: readonly Attribute[];
  value: readonly AxisDraft[];
  onChange: (next: AxisDraft[]) => void;
  /** Thuộc tính không được chọn làm trục (vd đang là thuộc tính mô tả của sản phẩm). */
  excludeAttributeIds?: readonly string[];
  /** Không thêm / gỡ trục (sản phẩm đã rời Nháp — BE `PRODUCT_AXES_LOCKED`). */
  structureLocked?: boolean;
  /** Không thêm trục mới (đã có biến thể mang tuỳ chọn) nhưng vẫn gỡ được trục chưa dùng. */
  addLocked?: boolean;
  /** Giá trị đang được biến thể dùng — không bỏ chọn được (BE `ATTRIBUTE_IN_USE`). */
  usedValueIds?: ReadonlySet<string>;
}

const orderValues = (values: readonly AttributeValue[]) =>
  [...values].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

/**
 * Chọn trục biến thể và giá trị của từng trục từ từ điển (BE `ReplaceAxesRequest` /
 * `CreateProductRequest.axes`). Chỉ SELECT / COLOR làm trục được; mỗi thuộc tính một trục; mỗi trục ít
 * nhất một giá trị còn dùng. Thứ tự trục là thứ tự hiển thị và thứ tự trong SKU sinh tự động.
 */
export function AxesPicker({
  attributes,
  value,
  onChange,
  excludeAttributeIds = [],
  structureLocked = false,
  addLocked = false,
  usedValueIds = new Set<string>(),
}: Props) {
  const byId = new Map(attributes.map((a) => [a.attributeId, a]));
  const chosen = new Set(value.map((axis) => axis.attributeId));
  const update = (index: number, patch: Partial<AxisDraft>) =>
    onChange(value.map((axis, i) => (i === index ? { ...axis, ...patch } : axis)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [axis] = next.splice(index, 1);
    if (axis) next.splice(index + delta, 0, axis);
    onChange(next);
  };
  const pickable = (current?: string) =>
    attributes.filter(
      (a) =>
        canBeVariantAxis(a.dataType) &&
        (a.active || a.attributeId === current) &&
        !excludeAttributeIds.includes(a.attributeId) &&
        (!chosen.has(a.attributeId) || a.attributeId === current),
    );

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-ink-tertiary text-xs">
          Chưa có trục nào — sản phẩm chỉ có một biến thể.
        </p>
      )}
      {value.map((axis, index) => {
        const attribute = byId.get(axis.attributeId);
        const axisUsed = attribute?.values.some((v) => usedValueIds.has(v.valueId)) ?? false;
        const values = orderValues(attribute?.values ?? []).filter(
          (v) => v.active || axis.optionValueIds.includes(v.valueId),
        );
        return (
          <fieldset
            key={axis.attributeId || `new-${index}`}
            className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3"
          >
            <div className="flex items-center gap-2">
              <Select
                value={axis.attributeId}
                // Đổi thuộc tính của trục thì bỏ các giá trị đã chọn (thuộc thuộc tính cũ).
                onValueChange={(attributeId) => update(index, { attributeId, optionValueIds: [] })}
                disabled={structureLocked}
              >
                <SelectTrigger aria-label={`Thuộc tính của trục ${index + 1}`} className="flex-1">
                  <SelectValue placeholder="Chọn thuộc tính" />
                </SelectTrigger>
                <SelectContent>
                  {pickable(axis.attributeId).map((a) => (
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
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Đưa trục xuống"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Gỡ trục"
                title={
                  structureLocked
                    ? "Chỉ gỡ được trục khi sản phẩm còn Nháp"
                    : axisUsed
                      ? "Đang có biến thể dùng giá trị của trục này"
                      : "Gỡ trục"
                }
                disabled={structureLocked || axisUsed}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
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
                          update(index, {
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
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={structureLocked || addLocked || pickable().length === 0}
        title={
          structureLocked
            ? "Chỉ thêm được trục khi sản phẩm còn Nháp"
            : addLocked
              ? "Đã có biến thể mang tuỳ chọn nên không thêm trục mới được"
              : undefined
        }
        onClick={() => onChange([...value, { attributeId: "", optionValueIds: [] }])}
      >
        <Plus className="size-3.5" /> Thêm trục
      </Button>
    </div>
  );
}
