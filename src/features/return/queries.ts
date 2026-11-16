import { useQuery } from "@tanstack/react-query";

import { RETURN_LIMITS } from "@/constants/returns";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getReturn, listReturns } from "./api";
import { getReturnReceipt, listReturnedShipments, listReturnReceipts } from "./receipt-api";

import type { ListReturnParams } from "./api";
import type { ListReturnReceiptParams } from "./receipt-api";
import type { ReturnReceipt, ReturnReceiptRow, ReturnRequest, ReturnRow } from "./types";

export const returnKeys = createQueryKeys<ListReturnParams>("returns");
export const returnReceiptKeys = createQueryKeys<ListReturnReceiptParams>("return-receipts");

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

/** Yêu cầu đang chờ hàng về — nguồn chọn khi lập phiếu nhập hàng hoàn. */
export const useAwaitingReturns = (enabled = true) =>
  useReturns(
    { statuses: ["AWAITING_RETURN"], page: 0, size: RETURN_LIMITS.pageSizeMax },
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
