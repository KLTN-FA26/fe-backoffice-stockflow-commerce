import { INVENTORY_LABELS } from "@/constants/inventory";

/**
 * ADR-0011 (BE): tồn đếm theo thùng — số thùng là số chính, số đơn vị cơ sở là thông tin phụ ngay dưới.
 * Vắng số đơn vị (BE bỏ dần các field đơn vị) → chỉ hiện số thùng.
 */
export function CartonQuantity({ cartons, units }: { cartons: number; units?: number | null }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-mono tabular-nums">{INVENTORY_LABELS.cartonCount(cartons)}</span>
      {units != null && (
        <span className="text-ink-tertiary font-mono text-xs tabular-nums">
          {INVENTORY_LABELS.unitCount(units)}
        </span>
      )}
    </span>
  );
}
