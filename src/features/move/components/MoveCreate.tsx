"use client";

import { useState } from "react";
import { cn } from "cn";
import { Plus } from "lucide-react";

import { MOVE_LABELS } from "@/constants/move";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { useCan } from "@/lib/auth";

import { TOOLBAR_ACTION_CLASS, TOOLBAR_PRIMARY_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { MoveCreateDialog } from "./MoveCreateDialog";

/**
 * Nút "Tạo lệnh di chuyển" cho `ListToolbar actions` của trang Di chuyển nội bộ — mở modal tạo lệnh (như "Lập phiếu" của
 * Kiểm kê). Chỉ hiện khi có inventory-stock-items:UPDATE — cùng guard với BE `POST /inventory/movements`.
 * UI-only — Backend phải re-check (@RequiresPermission inventory-stock-items:UPDATE).
 */
export function MoveCreate() {
  const canMove = useCan(INVENTORY_PERMISSIONS.stockUpdate);
  const [open, setOpen] = useState(false);
  if (!canMove) return null;
  return (
    <>
      <Button
        size="sm"
        className={cn(TOOLBAR_ACTION_CLASS, TOOLBAR_PRIMARY_CLASS)}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" />
        {MOVE_LABELS.formTitle}
      </Button>
      <MoveCreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
