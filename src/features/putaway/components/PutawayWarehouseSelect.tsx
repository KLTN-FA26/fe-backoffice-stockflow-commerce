"use client";

import { Warehouse } from "lucide-react";

import { PUTAWAY_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { WarehouseOption } from "@/lib/references/warehouse-options";

const L = PUTAWAY_LABELS;

export const warehouseLabel = (warehouse: Pick<WarehouseOption, "code" | "name">) =>
  warehouse.code ? `${warehouse.code} · ${warehouse.name}` : warehouse.name;

/**
 * Chọn kho của danh sách cất hàng — cùng dáng ô / nút công cụ của toolbar style Vercel (cao `--control-h`, bo
 * `--control-radius`, bóng `--control-shadow`). Bắt buộc (BE cần kho hoặc phiếu nhập) nên không có mục "Tất cả kho".
 * Kho trên URL mà danh mục không có (thiếu quyền / đang tải) vẫn hiện để còn đổi được.
 */
export function PutawayWarehouseSelect({
  value,
  warehouses,
  onChange,
}: {
  value: string | null;
  warehouses: readonly WarehouseOption[];
  onChange: (warehouseId: string) => void;
}) {
  return (
    <FormSelect value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        aria-label={L.warehouse}
        className="border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted w-60 rounded-(--control-radius) text-(length:--control-text) shadow-(--control-shadow) focus-visible:ring-0 data-[size=default]:h-(--control-h)"
      >
        <Warehouse className="text-dot-info size-3.5" />
        <SelectValue placeholder={L.warehousePlaceholder} />
      </SelectTrigger>
      <TitledSelectContent title={L.warehouseTitle} position="popper" align="end">
        {value && !warehouses.some((w) => w.warehouseId === value) && (
          <SelectItem value={value}>{value}</SelectItem>
        )}
        {warehouses.map((warehouse) => (
          <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
            {warehouseLabel(warehouse)}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </FormSelect>
  );
}
