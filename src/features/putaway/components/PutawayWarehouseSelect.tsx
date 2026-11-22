"use client";

import { cn } from "cn";
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
  widthClass = "w-56 xl:w-60",
}: {
  value: string | null;
  warehouses: readonly WarehouseOption[];
  onChange: (warehouseId: string) => void;
  /**
   * Chiều rộng (mặc định cỡ ô công cụ toolbar). Truyền thay vì `className`: `cn` của dự án chỉ nối chuỗi, không gộp
   * class Tailwind trùng thuộc tính, nên `w-full` đè `w-56` không chắc thắng.
   */
  widthClass?: string;
}) {
  return (
    <FormSelect value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        aria-label={L.warehouse}
        className={cn(
          // Không có class chiều rộng ở đây — chiều rộng chỉ đến từ `widthClass`
          "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-(--control-radius) text-(length:--control-text) shadow-(--control-shadow) focus-visible:ring-0 data-[size=default]:h-(--control-h)",
          widthClass,
        )}
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
