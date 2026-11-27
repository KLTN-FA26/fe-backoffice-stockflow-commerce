"use client";

import { cn } from "cn";
import { useId } from "react";

import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { Badge } from "@/components/ui/badge";

import { recommendedWarehouse } from "../../shipping-warehouse-rules";

import { CapacityDetails, CapacityWarnings, ProjectedFree } from "./WarehouseCapacity";

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

/**
 * Danh sách kho để Sale chọn kho xuất (docs 17 §4.2 bước 2): mỗi kho một thẻ chọn một. Thẻ chỉ có tên kho và đúng hai số
 * docs đòi — hàng có sẵn (thùng) và còn trống dự kiến (m³); mã kho, số thùng từng dòng và các số sức chứa khác nằm trong
 * "Chi tiết". Kho gợi ý (đầu danh sách) nói rõ lý do theo hai ưu tiên của docs; cảnh báo thiếu chỗ luôn hiện.
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
  const recommended = recommendedWarehouse(warehouses);
  return (
    <div role="radiogroup" aria-label={L.groupLabel} className="space-y-2">
      {warehouses.map((option) => {
        const reason =
          recommended?.warehouseId === option.warehouseId
            ? L.recommendedBecause[recommended.reason]
            : null;
        return (
          <div
            key={option.warehouseId}
            className={cn(
              "border-border-default rounded-[var(--r-sm)] border p-3",
              value === option.warehouseId && "border-ink-primary bg-bg-subtle",
            )}
          >
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name={group}
                value={option.warehouseId}
                checked={value === option.warehouseId}
                onChange={() => onChange(option.warehouseId)}
                className="accent-brand mt-1"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink-primary text-[0.8125rem] font-medium">
                    {option.warehouseName}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {option.holdsEveryLine && !reason && (
                      <Badge variant="secondary">{L.holdsEveryLine}</Badge>
                    )}
                    {option.warehouseId === chosenWarehouseId && (
                      <Badge variant="outline">{L.current}</Badge>
                    )}
                  </span>
                </span>
                {reason && (
                  <span className="text-ink-primary block text-xs font-medium">{reason}</span>
                )}
                <span className="text-ink-secondary block text-xs tabular-nums">
                  {L.available(option.availableCartons, total(option))}
                </span>
                <ProjectedFree option={option} />
              </span>
            </label>
            <div className="mt-1 space-y-1.5 pl-6">
              <CapacityWarnings option={option} />
              <details className="text-xs">
                <summary className="text-accent-text cursor-pointer select-none">
                  {L.details}
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-ink-secondary">
                    {L.warehouseCode}:{" "}
                    <span className="text-ink-primary font-[family-name:var(--font-mono)]">
                      {option.warehouseCode}
                    </span>
                  </p>
                  <ul className="text-ink-secondary space-y-0.5 tabular-nums">
                    {option.lines.map((line) => (
                      <li key={line.lineId}>
                        {L.lineAvailable(line.sku, line.availableCartons, line.cartons)}
                      </li>
                    ))}
                  </ul>
                  <CapacityDetails option={option} />
                </div>
              </details>
            </div>
          </div>
        );
      })}
      {warehouses.length === 1 && <p className="text-ink-secondary text-xs">{L.singleHint}</p>}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
