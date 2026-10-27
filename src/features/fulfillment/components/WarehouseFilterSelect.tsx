"use client";

import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

/**
 * Lọc theo kho (danh mục kho `lib/references`, mọi trạng thái — kho đã ngưng vẫn có thể còn task). `value`
 * null = không lọc. BE giới hạn theo kho người gọi phụ trách: chọn kho ngoài phạm vi → 403, màn tự báo.
 */
export function WarehouseFilterSelect({
  id,
  title,
  value,
  onChange,
  allLabel,
}: {
  id: string;
  title: string;
  value: string | null;
  onChange: (warehouseId: string | null) => void;
  allLabel: string;
}) {
  const { data: warehouses = [] } = useWarehouseDirectory();
  return (
    <FormSelect value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger
        id={id}
        className="border-border-default bg-bg-surface h-8 w-[14rem] rounded-[var(--r-sm)] text-[0.8125rem]"
      >
        <SelectValue />
      </SelectTrigger>
      <TitledSelectContent title={title}>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {value && !warehouses.some((w) => w.warehouseId === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {warehouses.map((warehouse) => (
          <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
            {warehouse.code ? `${warehouse.code} · ${warehouse.name}` : warehouse.name}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </FormSelect>
  );
}
