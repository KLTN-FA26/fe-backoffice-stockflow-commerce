"use client";

import { PACKAGE_TYPES, UI_LABELS } from "@/constants";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { PackageType } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing;

/** Chọn loại kiện (mặc định CARTON) — dùng ở nút mở kiện của trạm đóng gói đơn và của chuyển kho. */
export function PackageTypeSelect({
  value,
  onChange,
  id,
  className = "w-[9.5rem]",
}: {
  value: PackageType;
  onChange: (type: PackageType) => void;
  id?: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(PACKAGE_TYPES.find((t) => t === next) ?? "CARTON")}
    >
      <SelectTrigger
        id={id}
        aria-label={L.packages.typeLabel}
        className={`border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem] ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <TitledSelectContent title={L.packages.typeLabel}>
        {PACKAGE_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {L.packages.typeOption[type]}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </Select>
  );
}
