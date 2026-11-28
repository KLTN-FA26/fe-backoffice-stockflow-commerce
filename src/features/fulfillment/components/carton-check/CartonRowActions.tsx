"use client";

import { Barcode, Printer, RotateCcw, Tag, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { CartonActions } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton } from "@/features/fulfillment/carton-check-types";

const A = UI_LABELS.cartonCheck.action;

export interface CartonRowHandlers {
  onLabel: (carton: Carton) => void;
  onPrint: (carton: Carton) => void;
  onReprint: (carton: Carton) => void;
  /** In lại nhãn LPN của thùng; vắng khi màn không có hộp thoại in nhãn thùng (xem `CartonLpnLabelSlot`). */
  onReprintLpn?: (carton: Carton) => void;
  onRemove: (carton: Carton) => void;
}

/** Thao tác của một thùng ở trạm kiểm — hiện theo `cartonActions` (trạng thái thùng + bảng chuyển trạng thái + quyền). */
export function CartonRowActions({
  carton,
  actions,
  labeling,
  handlers,
  labelHeld,
  heldTitle,
}: {
  carton: Carton;
  actions: CartonActions;
  labeling: boolean;
  handlers: CartonRowHandlers;
  /** Đơn treo: hiện nút dán nhãn bị tắt (WF4-K2), `heldTitle` nói lý do. */
  labelHeld?: boolean;
  heldTitle?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.label && (
        <Button
          type="button"
          size="xs"
          disabled={labeling}
          onClick={() => handlers.onLabel(carton)}
        >
          <Tag className="size-3" /> {A.label}
        </Button>
      )}
      {labelHeld && (
        <Button type="button" size="xs" disabled title={heldTitle}>
          <Tag className="size-3" /> {A.label}
        </Button>
      )}
      {actions.print && (
        <Button type="button" size="xs" variant="outline" onClick={() => handlers.onPrint(carton)}>
          <Printer className="size-3" /> {A.print}
        </Button>
      )}
      {actions.reprint && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => handlers.onReprint(carton)}
        >
          <RotateCcw className="size-3" /> {A.reprint}
        </Button>
      )}
      {actions.reprintLpn && handlers.onReprintLpn && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => handlers.onReprintLpn?.(carton)}
        >
          <Barcode className="size-3" /> {A.reprintLpn}
        </Button>
      )}
      {actions.remove && (
        <Button type="button" size="xs" variant="outline" onClick={() => handlers.onRemove(carton)}>
          <Trash2 className="size-3" /> {A.remove}
        </Button>
      )}
    </div>
  );
}
