"use client";

import { UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const L = UI_LABELS.loadPlan;
const ALL = "__all__";

interface WarehouseSelectProps {
  id: string;
  value: string;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Có thì thêm lựa chọn "tất cả" mang nhãn này (bỏ lọc theo kho → giá trị rỗng). */
  allLabel?: string;
}

/** Chọn kho từ danh mục kho (`lib/references`); BE giới hạn theo kho người dùng phụ trách ở mọi API kế hoạch. */
export function WarehouseSelect({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = L.createForm.warehousePlaceholder,
  allLabel,
}: WarehouseSelectProps) {
  const { data: warehouses = [] } = useWarehouseDirectory();
  const active = warehouses.filter(
    (warehouse) => warehouse.active || warehouse.warehouseId === value,
  );
  return (
    <FormSelect
      value={value || (allLabel ? ALL : "")}
      onValueChange={(next) => onChange(next === ALL ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <TitledSelectContent title={L.createForm.warehouse}>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {value && !active.some((w) => w.warehouseId === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {active.map((warehouse) => (
          <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
            {warehouse.code ? `${warehouse.code} · ${warehouse.name}` : warehouse.name}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </FormSelect>
  );
}
