import { useQuery } from "@tanstack/react-query";

import { RETURN_LIMITS, RETURN_RECEIPT_SOURCE_STATUSES } from "@/constants/returns";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getReturn, listReturns } from "./api";
import { listCustomerCustody } from "./custody-api";
import { getReturnReceipt, listReturnedShipments, listReturnReceipts } from "./receipt-api";

import type { ListReturnParams } from "./api";
import type { CustomerCustodyParams } from "./custody-api";
import type { ListReturnReceiptParams } from "./receipt-api";
import type { ReturnReceipt, ReturnReceiptRow, ReturnRequest, ReturnRow } from "./types";

export const returnKeys = createQueryKeys<ListReturnParams>("returns");
export const returnReceiptKeys = createQueryKeys<ListReturnReceiptParams>("return-receipts");
/** Thùng giữ hộ khách (WF-05 Q-4) — khoá riêng: kho đọc, Sale đổi lựa chọn, Quản lý kho thực hiện. */
export const customerCustodyKeys = { all: ["customer-custody"] as const };

/** Thùng giữ hộ khách (`GET /inventory/stock-packages/customer-custody`), theo yêu cầu hoặc toàn kho. */
export const useCustomerCustody = (params: CustomerCustodyParams, enabled = true) =>
  useQuery({
    queryKey: [...customerCustodyKeys.all, params],
    queryFn: ({ signal }) => listCustomerCustody(params, signal),
    enabled,
    ...QUERY_TIMES.list,
  });

export const useReturns = createListQuery<ReturnRow, ListReturnParams>(returnKeys, listReturns);
export const useReturn = createDetailQuery<ReturnRequest>(returnKeys, getReturn);
export const useReturnReceipts = createListQuery<ReturnReceiptRow, ListReturnReceiptParams>(
  returnReceiptKeys,
  listReturnReceipts,
);
export const useReturnReceipt = createDetailQuery<ReturnReceipt>(
  returnReceiptKeys,
  getReturnReceipt,
);

/** Các yêu cầu trả hàng của một đơn (thẻ trên màn đơn) — mới nhất trước. */
export const useOrderReturns = (orderId: string | null | undefined, enabled = true) =>
  useReturns(
    { orderId: orderId ?? "", page: 0, size: 50, sort: "requestedAt,desc" },
    { enabled: enabled && !!orderId },
  );

/**
 * Yêu cầu có thể nhận phiếu nhập hàng hoàn — nguồn chọn khi lập phiếu (WF-05 Q-11, BE-13: cả hàng về muộn). Tải mọi
 * trạng thái BE có thể cho mở phiếu; màn lọc bằng `receiptOpenableRow` (cờ của BE, dự phòng theo trạng thái).
 */
export const useReceiptSourceReturns = (enabled = true) =>
  useReturns(
    { statuses: RETURN_RECEIPT_SOURCE_STATUSES, page: 0, size: RETURN_LIMITS.pageSizeMax },
    { enabled },
  );

/** Chuyến hãng đã hoàn về — nguồn phiếu RTO. */
export const useReturnedShipments = (enabled = true) =>
  useQuery({
    queryKey: [...returnReceiptKeys.all, "returned-shipments"],
    queryFn: ({ signal }) => listReturnedShipments(RETURN_LIMITS.pageSizeMax, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
