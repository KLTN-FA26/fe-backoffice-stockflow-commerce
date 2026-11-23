"use client";

import { GOODS_RECEIPT_PERMISSIONS, WORKSPACE_PATHS } from "@/constants";
import { useCan } from "@/lib/auth";
import { InWorkspaceWarehouse } from "@/lib/workspace";
import { useGoodsReceipt } from "@/features/receipt/queries";

import { ReceiptDetail } from "../ReceiptDetail";

/**
 * Phiếu theo Đơn sản xuất trong tab theo kho: cùng màn kiểm đếm / xác nhận như trang Phiếu nhận. Phiếu thuộc kho
 * khác kho trên URL → chuyển sang đúng kho (cùng query với `ReceiptDetail`, không gọi API thêm).
 */
export function ReceivingReceiptDetail({ id }: { id: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const query = useGoodsReceipt(id, { enabled: canRead });
  return (
    <InWorkspaceWarehouse
      warehouseId={query.data?.warehouseId}
      path={WORKSPACE_PATHS.receivingReceipt(id)}
    >
      <ReceiptDetail id={id} />
    </InWorkspaceWarehouse>
  );
}
