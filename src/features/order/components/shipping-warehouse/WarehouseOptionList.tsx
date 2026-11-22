"use client";

import { cn } from "cn";
import { useId } from "react";

import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";

import { WarehouseCapacity } from "./WarehouseCapacity";

import type { ShippingWarehouseOption } from "../../shipping-warehouse-schemas";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.dialog;

interface WarehouseOptionListProps {
  /** Các kho theo thứ tự gợi ý của BE (tốt nhất đầu danh sách). */
  warehouses: readonly ShippingWarehouseOption[];
  value: string;
  /** Kho đang là kho xuất của đơn (nếu có). */
  chosenWarehouseId: string | null | undefined;
  onChange: (warehouseId: string) => void;
  error: string | undefined;
}

function OptionBadges({
  option,
  recommended,
  current,
}: {
  option: ShippingWarehouseOption;
  recommended: boolean;
  current: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {recommended && <Badge variant="secondary">{L.recommended}</Badge>}
      {option.holdsEveryLine && <Badge variant="secondary">{L.holdsEveryLine}</Badge>}
      {current && <Badge variant="outline">{L.current}</Badge>}
    </span>
  );
}

/**
 * Danh sách kho để Sale chọn kho xuất (docs 17 §4.2 bước 2): mỗi kho một thẻ chọn một — tên kho, số thùng có sẵn so với
 * số thùng đơn cần theo từng dòng, sức chứa kèm cảnh báo. Kho đầu danh sách là kho hệ thống gợi ý (BE đã xếp thứ tự).
 */
export function WarehouseOptionList({
  warehouses,
  value,
  chosenWarehouseId,
  onChange,
  error,
}: WarehouseOptionListProps) {
  const group = useId();
  const total = (option: ShippingWarehouseOption) =>
    option.lines.reduce((sum, line) => sum + line.cartons, 0);
  return (
    <div role="radiogroup" aria-label={L.groupLabel} className="space-y-2">
      {warehouses.map((option, index) => (
        <label
          key={option.warehouseId}
          className={cn(
            "border-border-default flex cursor-pointer items-start gap-2.5 rounded-[var(--r-sm)] border p-3",
            value === option.warehouseId && "border-ink-primary bg-bg-subtle",
          )}
        >
          <input
            type="radio"
            name={group}
            value={option.warehouseId}
            checked={value === option.warehouseId}
            onChange={() => onChange(option.warehouseId)}
            className="accent-brand mt-1"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink-primary text-[0.8125rem] font-medium">
                {option.warehouseCode} — {option.warehouseName}
              </span>
              <OptionBadges
                option={option}
                recommended={index === 0}
                current={option.warehouseId === chosenWarehouseId}
              />
            </span>
            <span className="text-ink-secondary mt-0.5 block text-xs tabular-nums">
              {L.available(option.availableCartons, total(option))}
            </span>
            <ul className="text-ink-secondary mt-1 space-y-0.5 text-xs tabular-nums">
              {option.lines.map((line) => (
                <li key={line.lineId}>
                  {L.lineAvailable(line.sku, line.availableCartons, line.cartons)}
                </li>
              ))}
            </ul>
            <WarehouseCapacity option={option} />
          </span>
        </label>
      ))}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
