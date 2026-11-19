"use client";

import { UI_LABELS } from "@/constants";
import { useImportWarehouses } from "@/features/shipping/queries";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const I = UI_LABELS.shipping.waybill.import;

/** Chọn kho nhập mã vận đơn: chỉ kho BE cho phép (kho được gán), nên không có lựa chọn nào kết thúc bằng 403. */
export function ImportWarehouseSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (warehouseId: string) => void;
}) {
  const { data: warehouses = [] } = useImportWarehouses();
  return (
    <FormSelect value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
      >
        <SelectValue placeholder={I.warehousePlaceholder} />
      </SelectTrigger>
      <TitledSelectContent title={I.warehouseLabel}>
        {warehouses.map((warehouse) => (
          <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
            {warehouse.code ? `${warehouse.code} · ${warehouse.name}` : warehouse.name}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </FormSelect>
  );
}
