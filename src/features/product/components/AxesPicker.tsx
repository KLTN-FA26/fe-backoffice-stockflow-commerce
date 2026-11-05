"use client";

import Link from "next/link";
import { Lock, Plus } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import { Button } from "@/components/ui/button";

import { canBeVariantAxis } from "../attribute-schemas";
import { AxisFieldset } from "./AxisFieldset";

import type { Attribute } from "../attribute-schemas";
import type { AxisDraft } from "../axes-draft";

const L = UI_LABELS.product.axes;

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

/**
 * Chọn trục biến thể và giá trị của từng trục từ từ điển (BE `ReplaceAxesRequest` /
 * `CreateProductRequest.axes`). Chỉ SELECT / COLOR làm trục được; mỗi thuộc tính một trục; mỗi trục ít
 * nhất một giá trị còn dùng. Thứ tự trục là thứ tự hiển thị và thứ tự trong SKU sinh tự động.
 * Bộ trục bị khoá thì nói lý do bằng chữ ngay trên danh sách (BE `ProductAttributeSet.replaceAxes`).
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
  const lockReason = structureLocked ? L.lockNotDraft : addLocked ? L.lockOptionUsed : null;
  const noCandidates = lockReason === null && pickable().length === 0;

  return (
    <div className="space-y-3">
      {lockReason && (
        <p className="border-border-default bg-bg-subtle text-ink-secondary flex gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
          <Lock aria-hidden className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" />
          {lockReason}
        </p>
      )}
      {value.length === 0 && (
        <p className="text-ink-tertiary text-xs">
          Chưa có trục nào — sản phẩm chỉ có một biến thể.
        </p>
      )}
      {value.map((axis, index) => (
        <AxisFieldset
          key={axis.attributeId || `new-${index}`}
          index={index}
          count={value.length}
          axis={axis}
          attribute={byId.get(axis.attributeId)}
          pickable={pickable(axis.attributeId)}
          structureLocked={structureLocked}
          usedValueIds={usedValueIds}
          onChange={(patch) => update(index, patch)}
          onMove={(delta) => move(index, delta)}
          onRemove={() => onChange(value.filter((_, i) => i !== index))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={lockReason !== null || noCandidates}
        onClick={() => onChange([...value, { attributeId: "", optionValueIds: [] }])}
      >
        <Plus className="size-3.5" /> Thêm trục
      </Button>
      {noCandidates && (
        <p className="text-ink-tertiary text-xs">
          {L.noCandidates}{" "}
          {/* Tab mới: điều hướng tại chỗ đóng dialog / rời form và mất thay đổi chưa lưu */}
          <Link
            href={ADMIN_ROUTES.attributes}
            target="_blank"
            rel="noreferrer"
            className="text-info font-medium hover:underline"
          >
            {L.manageAttributes}
          </Link>
        </p>
      )}
    </div>
  );
}
