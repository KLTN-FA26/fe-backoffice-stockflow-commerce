"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { cn } from "@/lib/utils";
import { usePermissionChecker } from "@/lib/auth";
import { productionReceiptCreateGate } from "@/features/receipt/lifecycle";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { CreateProductionReceiptDialog } from "./CreateProductionReceiptDialog";

const REASON_ID = "gr-create-disabled-reason";

/**
 * Nút "Lập phiếu nhập" trong `ListToolbar actions` (data-table-mode-a §1). Gate qua `productionReceiptCreateGate`:
 * không có quyền lập phiếu → không hiện; thiếu quyền đọc Đơn sản xuất → hiện nút khoá, lý do ở tooltip + sr-only.
 */
export function CreateReceiptAction() {
  const can = usePermissionChecker();
  const gate = productionReceiptCreateGate(can);
  const [open, setOpen] = useState(false);
  if (!gate) return null;
  const reason = gate.disabledReason;

  return (
    <>
      <span title={reason} className="inline-flex">
        <Button
          type="button"
          disabled={!!reason}
          aria-describedby={reason ? REASON_ID : undefined}
          onClick={() => setOpen(true)}
          className={cn(
            "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
            TOOLBAR_ACTION_CLASS,
          )}
        >
          <Plus className="size-3.5" />
          {RECEIPT_COUNT_LABELS.create.button}
        </Button>
      </span>
      {reason && (
        <span id={REASON_ID} className="sr-only">
          {reason}
        </span>
      )}
      <CreateProductionReceiptDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
