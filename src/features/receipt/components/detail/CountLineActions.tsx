"use client";

import { Copy, Trash2 } from "lucide-react";

import { RECEIPT_CARTON_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

/**
 * Nút của một dòng kiểm đếm: tách lô, bỏ dòng. Dòng đã có thùng không bỏ khỏi phiếu được
 * (BE `RECEIPT_LINE_HAS_PACKAGES`, SCRUM-473) — nút khoá kèm lý do.
 */
export function CountLineActions({
  lineNo,
  locked,
  onSplit,
  onRemove,
}: {
  lineNo: number;
  locked: boolean;
  onSplit: () => void;
  onRemove: () => void;
}) {
  return (
    <td className="w-20 px-2 py-2">
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onSplit}
          aria-label={`Tách lô dòng ${lineNo}`}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={locked}
          title={locked ? RECEIPT_CARTON_LABELS.removeLineLocked : undefined}
          aria-label={`Xoá dòng ${lineNo}`}
        >
          <Trash2 className="text-danger size-3.5" />
        </Button>
      </div>
    </td>
  );
}
