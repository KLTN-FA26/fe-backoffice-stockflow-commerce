"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import type { Control, FieldPathByValue, FieldValues } from "react-hook-form";

const L = UI_LABELS.taxonomy;

/** Nhãn "Đang dùng" / "Đã ngưng" của cờ `active` trong bảng thương hiệu / danh mục. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active ? "border-positive/30 bg-positive/10 text-positive" : "text-ink-tertiary bg-bg-muted"
      }
    >
      {active ? L.active : L.inactive}
    </Badge>
  );
}

/** Ô tick boolean gắn react-hook-form — cờ "Đang dùng" của form thương hiệu / danh mục. */
export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>;
  name: FieldPathByValue<T, boolean>;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
          {label}
        </label>
      )}
    />
  );
}
