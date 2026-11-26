"use client";

import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
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
export function CreateReceiptAction({
  handleLink = true,
  detailHref,
}: {
  /** Chỉ một nút trên màn đọc `?productionOrder=` — nút thứ hai (trạng thái trống) đặt `false` để không mở hai hộp. */
  handleLink?: boolean;
  /** Đường dẫn trang phiếu vừa lập (mặc định nhóm Nhập kho; màn nhận hàng của kho ở lại trong tab kho). */
  detailHref?: (receiptId: string) => string;
} = {}) {
  const can = usePermissionChecker();
  const gate = productionReceiptCreateGate(can);
  const [clicked, setClicked] = useState(false);
  // `?productionOrder=` — mở từ một Đơn sản xuất: hộp Lập mở sẵn với đơn đó đã chọn (bỏ tham số khi đóng)
  const [linked, setLinked] = useQueryState("productionOrder", parseAsString);
  const open = clicked || (handleLink && !!linked && !!gate && !gate.disabledReason);
  const close = () => {
    setClicked(false);
    if (handleLink && linked) void setLinked(null);
  };
  if (!gate) return null;
  const reason = gate.disabledReason;

  return (
    <>
      <span title={reason} className="inline-flex">
        <Button
          type="button"
          disabled={!!reason}
          aria-describedby={reason ? REASON_ID : undefined}
          onClick={() => setClicked(true)}
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
      <CreateProductionReceiptDialog
        open={open}
        onClose={close}
        productionOrderId={handleLink ? (linked ?? undefined) : undefined}
        detailHref={detailHref}
      />
    </>
  );
}
