"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { cartonUnitOptions, looseRemainder } from "@/features/receipt/carton-selectors";
import { Button } from "@/components/ui/button";

import type { LineCartonContext } from "@/features/receipt/carton-selectors";

/**
 * Ô "Thùng" của dòng kiểm đếm: tóm tắt thùng / hàng lẻ và nút mở trình chia thùng. Chưa biết đơn vị của SKU (chưa có
 * dòng nào của SKU được lưu — `units[]` chỉ có trên dòng đã lưu, Q1 đã duyệt) → nhắc lưu trước.
 */
export function CartonToggleCell({
  lineNo,
  quantity,
  packages,
  context,
  expanded,
  onToggle,
}: {
  lineNo: number;
  quantity: number;
  packages: readonly { quantity: number }[];
  context: LineCartonContext;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (context.units.length === 0 || cartonUnitOptions(context).length === 0) {
    return (
      <td className="text-ink-tertiary w-36 px-2 py-2 text-xs">
        {context.units.length === 0 ? L.saveFirst : L.noPackingUnit}
      </td>
    );
  }
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <td className="w-36 px-2 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`${L.splitAction} dòng ${lineNo}`}
        aria-expanded={expanded}
        onClick={onToggle}
        className="w-full justify-between tabular-nums"
      >
        {packages.length > 0
          ? L.cellSummary(packages.length, looseRemainder(Number(quantity) || 0, packages))
          : L.splitAction}
        <Chevron className="size-3.5" />
      </Button>
    </td>
  );
}
