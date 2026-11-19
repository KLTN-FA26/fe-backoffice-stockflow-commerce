"use client";

import { UI_LABELS } from "@/constants";

import { capacityWarnings } from "@/features/warehouse-capacity/selectors";

import { Alert } from "@/components/shared/Alert";

import { formatM3 } from "../parts";

import type { CapacityWarning } from "@/features/warehouse-capacity/selectors";
import type { CapacityBoard } from "@/features/warehouse-capacity/types";

const W = UI_LABELS.warehouseCapacity.warning;

function content(warning: CapacityWarning): { title?: string; text: string } {
  switch (warning.key) {
    case "negative":
      return { title: W.negativeTitle, text: W.negative(formatM3(warning.value)) };
    case "negativeIfApproved":
      return {
        title: W.negativeIfApprovedTitle,
        text: W.negativeIfApproved(formatM3(warning.value)),
      };
    case "binsWithoutVolume":
      return { text: W.binsWithoutVolume(warning.value) };
    case "cartonsWithoutSize":
      return { text: W.cartonsWithoutSize(warning.value) };
    default:
      return { text: W.productionCartonsWithoutSize(warning.value) };
  }
}

/**
 * Cảnh báo của kho (docs 06 §4.6 bước 5–7, BR-21; ghi chú C40): kho thiếu chỗ và số liệu chưa đủ vì vị trí / thùng
 * thiếu kích thước. Chỉ báo, không chặn thao tác nào.
 */
export function CapacityWarnings({ board }: { board: CapacityBoard }) {
  const warnings = capacityWarnings(board);
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-2">
      {warnings.map((warning) => {
        const { title, text } = content(warning);
        return (
          <Alert key={warning.key} tone={warning.tone} title={title}>
            {text}
          </Alert>
        );
      })}
    </div>
  );
}
