"use client";

import { Barcode, Printer, RotateCcw, Tag, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { CartonActions } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton } from "@/features/fulfillment/carton-check-types";

const A = UI_LABELS.cartonCheck.action;

/** Cột thao tác ghim mép phải khung cuộn: nút "⋯" của thùng luôn thấy được ở 1440px dù bảng rộng hơn (như cột thao tác của danh sách nhiệm vụ). */
export const PINNED =
  "sticky right-0 shadow-[inset_1px_0_0_var(--table-line),-6px_0_8px_-6px_rgb(0_0_0/0.12)]";

export interface CartonRowHandlers {
  onLabel: (carton: Carton) => void;
  onPrint: (carton: Carton) => void;
  onReprint: (carton: Carton) => void;
  /** In lại nhãn LPN của thùng; vắng khi màn không có hộp thoại in nhãn thùng (xem `CartonLpnLabelSlot`). */
  onReprintLpn?: (carton: Carton) => void;
  onRemove: (carton: Carton) => void;
}

/**
 * Thao tác của một thùng ở trạm kiểm — hiện theo `cartonActions` (trạng thái thùng + bảng chuyển trạng thái + quyền),
 * gom vào MỘT nút "⋯" (backoffice-erp-ui A6; nút 44px trên màn cảm ứng của kho). Thứ tự: việc chính theo trạng thái
 * (Dán nhãn khi chưa dán, In nhãn khi đã dán), in lại nhãn, in lại nhãn LPN; "Loại thùng" (huỷ thùng, có hộp thoại hỏi
 * lại) chữ đỏ ở cuối để không bấm nhầm.
 */
export function CartonRowActions({
  carton,
  actions,
  labeling,
  handlers,
}: {
  carton: Carton;
  actions: CartonActions;
  labeling: boolean;
  handlers: CartonRowHandlers;
}) {
  const menu: RowAction[] = [];
  if (actions.label) {
    menu.push({
      label: A.label,
      icon: Tag,
      disabled: labeling,
      onSelect: () => handlers.onLabel(carton),
    });
  }
  if (actions.print) {
    menu.push({ label: A.print, icon: Printer, onSelect: () => handlers.onPrint(carton) });
  }
  if (actions.reprint) {
    menu.push({ label: A.reprint, icon: RotateCcw, onSelect: () => handlers.onReprint(carton) });
  }
  const reprintLpn = handlers.onReprintLpn;
  if (actions.reprintLpn && reprintLpn) {
    menu.push({ label: A.reprintLpn, icon: Barcode, onSelect: () => reprintLpn(carton) });
  }
  if (actions.remove) {
    menu.push({
      label: A.remove,
      icon: Trash2,
      danger: true,
      onSelect: () => handlers.onRemove(carton),
    });
  }
  return <RowActionsMenu label={A.more(carton.lpn)} actions={menu} />;
}
