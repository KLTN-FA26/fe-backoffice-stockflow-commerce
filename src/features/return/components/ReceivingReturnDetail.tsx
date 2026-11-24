"use client";

import { RECEIVING_LABELS, WORKSPACE_PATHS } from "@/constants";
import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import { useCan } from "@/lib/auth/components/Can";
import { InWorkspaceWarehouse, useWorkspaceHref } from "@/lib/workspace";

import { useReturnReceipt } from "../queries";

import { ReturnReceiptDetail } from "./ReturnReceiptDetail";

/**
 * Phiếu hàng hoàn trong tab theo kho (docs 03 §4.2): quét LPN, xác nhận ngay tại kho; nút quay lại về màn Nhận hàng
 * của kho. Phiếu thuộc kho khác kho trên URL → chuyển sang đúng kho.
 */
export function ReceivingReturnDetail({ id }: { id: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const query = useReturnReceipt(id, { enabled: canRead });
  const href = useWorkspaceHref();
  return (
    <InWorkspaceWarehouse
      warehouseId={query.data?.warehouseId}
      path={WORKSPACE_PATHS.receivingReturn(id)}
    >
      <ReturnReceiptDetail
        id={id}
        back={{ href: href(WORKSPACE_PATHS.receiving), label: RECEIVING_LABELS.title }}
      />
    </InWorkspaceWarehouse>
  );
}
