import { useQuery } from "@tanstack/react-query";

import { PAGE_SIZE, RECEIPT_STATUS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getGoodsReceipt, listGoodsReceipts } from "./api";
import {
  getReceivablePurchaseOrder,
  listPurchaseOrderNumbers,
  listReceivablePurchaseOrders,
} from "./receivable-po-api";

import type { ListGoodsReceiptParams } from "./api";
import type { ListReceivablePoParams } from "./receivable-po-api";
import type { GoodsReceipt, GoodsReceiptRow, ReceivablePo } from "./types";

export const receiptKeys = createQueryKeys<ListGoodsReceiptParams>("goods-receipts");
/** PO để nhận hàng — key riêng của receipt (không dùng chung poKeys, tránh import feature PO). */
export const receivablePoKeys = createQueryKeys<ListReceivablePoParams>("receipt-receivable-pos");

export const useGoodsReceipts = createListQuery<GoodsReceiptRow, ListGoodsReceiptParams>(
  receiptKeys,
  listGoodsReceipts,
);

export const useGoodsReceipt = createDetailQuery<GoodsReceipt>(receiptKeys, getGoodsReceipt);

export const useReceivablePurchaseOrders = createListQuery<ReceivablePo, ListReceivablePoParams>(
  receivablePoKeys,
  listReceivablePurchaseOrders,
);

export const useReceivablePurchaseOrder = createDetailQuery<ReceivablePo>(
  receivablePoKeys,
  getReceivablePurchaseOrder,
);

/** id PO → số PO (cột danh sách). Cần `purchase-orders:READ` — thiếu thì tắt, cột hiện "—". */
export function usePurchaseOrderNumbers(enabled: boolean) {
  return useQuery({
    queryKey: [...receivablePoKeys.all, "numbers"],
    queryFn: ({ signal }) => listPurchaseOrderNumbers(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}

/**
 * Phiếu nháp khác của một PO — BE cho tạo nhiều phiếu nháp cho một PO và tính cả chúng vào dung
 * sai (BR-02), nên màn tạo phiếu cảnh báo để không đếm trùng.
 */
export function usePoDraftReceipts(poId: string | undefined) {
  const list = useGoodsReceipts(
    { purchaseOrderId: poId, size: PAGE_SIZE.masterData, status: [RECEIPT_STATUS.DRAFT] },
    { enabled: !!poId },
  );
  return list.data?.items ?? [];
}
