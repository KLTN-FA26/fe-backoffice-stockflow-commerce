"use client";

import { useState } from "react";
import { Barcode, MoreHorizontal, Printer, RotateCcw, Tag, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { LucideIcon } from "lucide-react";
import type { CartonActions } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton } from "@/features/fulfillment/carton-check-types";

const A = UI_LABELS.cartonCheck.action;

/** Nút trên dòng thùng: cao 32px, 44px trên màn cảm ứng (kho) — không còn nút 24px sát nhau. */
const ROW_BUTTON = "h-8 gap-1.5 rounded-[var(--r-sm)] px-3 text-[0.8125rem] pointer-coarse:h-11";

export interface CartonRowHandlers {
  onLabel: (carton: Carton) => void;
  onPrint: (carton: Carton) => void;
  onReprint: (carton: Carton) => void;
  /** In lại nhãn LPN của thùng; vắng khi màn không có hộp thoại in nhãn thùng (xem `CartonLpnLabelSlot`). */
  onReprintLpn?: (carton: Carton) => void;
  onRemove: (carton: Carton) => void;
}

/**
 * Thao tác của một thùng ở trạm kiểm — hiện theo `cartonActions` (trạng thái thùng + bảng chuyển trạng thái + quyền).
 * MỘT nút chính theo trạng thái (Dán nhãn khi chưa dán, In nhãn khi đã dán), các thao tác phụ (in lại nhãn, in lại nhãn
 * LPN) nằm trong trình đơn "…", còn "Loại thùng" (huỷ thùng, có hộp thoại hỏi lại) tách riêng ở cuối dòng, cách xa để
 * không bấm nhầm.
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
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = actions.label ? "label" : actions.print ? "print" : null;
  // Thao tác phụ: in lại nhãn giao, in lại nhãn LPN, và "In nhãn" khi nút chính đang là "Dán nhãn"
  const secondary: { key: string; label: string; icon: LucideIcon; run: () => void }[] = [];
  if (actions.print && primary !== "print") {
    secondary.push({
      key: "print",
      label: A.print,
      icon: Printer,
      run: () => handlers.onPrint(carton),
    });
  }
  if (actions.reprint) {
    secondary.push({
      key: "reprint",
      label: A.reprint,
      icon: RotateCcw,
      run: () => handlers.onReprint(carton),
    });
  }
  const reprintLpn = handlers.onReprintLpn;
  if (actions.reprintLpn && reprintLpn) {
    secondary.push({
      key: "reprintLpn",
      label: A.reprintLpn,
      icon: Barcode,
      run: () => reprintLpn(carton),
    });
  }

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {primary === "label" && (
        <Button
          type="button"
          size="sm"
          disabled={labeling}
          onClick={() => handlers.onLabel(carton)}
          className={ROW_BUTTON}
        >
          <Tag className="size-3.5" /> {A.label}
        </Button>
      )}
      {primary === "print" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handlers.onPrint(carton)}
          className={ROW_BUTTON}
        >
          <Printer className="size-3.5" /> {A.print}
        </Button>
      )}
      {secondary.length > 0 && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={A.more(carton.lpn)}
              className={`${ROW_BUTTON} px-2`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 gap-1 p-1">
            {secondary.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                onClick={() => {
                  setMenuOpen(false);
                  item.run();
                }}
                className="h-9 justify-start gap-2 px-2 text-[0.8125rem] pointer-coarse:h-11"
              >
                <item.icon className="size-3.5" /> {item.label}
              </Button>
            ))}
          </PopoverContent>
        </Popover>
      )}
      {actions.remove && (
        // Tách xa các nút còn lại (ml-4) và chữ đỏ: huỷ thùng không hoàn tác, có hộp thoại hỏi lại ở bước sau
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handlers.onRemove(carton)}
          className={`${ROW_BUTTON} text-danger border-danger/40 hover:text-danger ml-4`}
        >
          <Trash2 className="size-3.5" /> {A.remove}
        </Button>
      )}
    </div>
  );
}
