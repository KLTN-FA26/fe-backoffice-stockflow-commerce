"use client";

import { Boxes } from "lucide-react";
import { useState } from "react";

import { LOAD_ESTIMATE_LABELS, LOAD_ESTIMATE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { LoadEstimateDrawer } from "./LoadEstimateDrawer";

export interface LoadEstimateButtonProps {
  orderId: string;
  orderNumber: string;
  /** Kho đang chọn trong hộp thoại release (đơn CONFIRMED); null với đơn đã release. */
  warehouseId: string | null;
  /** false = đơn CONFIRMED chưa release: bắt buộc có kho trước khi ước tính. */
  released: boolean;
}

/**
 * Nút mở ngăn kéo ước tính xếp xe — khe `estimateSlot` của màn đơn (hộp thoại release và chi tiết đơn đã release).
 * Hiện khi có MỘT trong hai mã quyền: `fulfillment-load-estimates:READ` (xem ước tính hiện hành) hoặc `:CREATE`
 * (tính mới); thiếu cả hai thì không hiện gì. UI-only — Backend phải re-check từng lần gọi.
 */
export function LoadEstimateButton(props: LoadEstimateButtonProps) {
  const [open, setOpen] = useState(false);
  const can = usePermissionChecker();
  const canCreate = can(LOAD_ESTIMATE_PERMISSIONS.create);
  const canRead = can(LOAD_ESTIMATE_PERMISSIONS.read);
  if (!canCreate && !canRead) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Boxes className="size-3.5" aria-hidden="true" /> {LOAD_ESTIMATE_LABELS.open}
      </Button>
      {open && (
        <LoadEstimateDrawer
          open
          onClose={() => setOpen(false)}
          orderId={props.orderId}
          orderNumber={props.orderNumber}
          warehouseId={props.warehouseId}
          released={props.released}
          canCreate={canCreate}
          canRead={canRead}
        />
      )}
    </>
  );
}
