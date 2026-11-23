import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getInstallment,
  getOrderInstallments,
  getOrderRefund,
  getReceipt,
  getReceiptSummary,
  listInstallments,
  listReceipts,
  listReceivables,
  listRefunds,
} from "./api";

import type {
  ListInstallmentParams,
  ListReceiptParams,
  ListReceivableParams,
  ListRefundParams,
  ReceiptFilterParams,
} from "./api";
import type {
  Installment,
  OrderInstallments,
  OrderRefund,
  PaymentReceipt,
  Receivable,
} from "./types";

export const installmentKeys = createQueryKeys<ListInstallmentParams>("payment-installments");
export const receiptKeys = createQueryKeys<ListReceiptParams>("payment-receipts");
export const refundKeys = createQueryKeys<ListRefundParams>("payment-refunds");
export const receivableKeys = createQueryKeys<ListReceivableParams>("payment-receivables");

export const useInstallments = createListQuery<Installment, ListInstallmentParams>(
  installmentKeys,
  listInstallments,
);
export const useInstallment = createDetailQuery<Installment>(installmentKeys, getInstallment);
export const useReceipts = createListQuery<PaymentReceipt, ListReceiptParams>(
  receiptKeys,
  listReceipts,
);
/** Tổng theo bộ lọc; nằm dưới `receiptKeys.all` nên lập / huỷ phiếu làm mới luôn. */
export const useReceiptSummary = (filter: ReceiptFilterParams, enabled = true) =>
  useQuery({
    queryKey: [...receiptKeys.all, "summary", filter],
    queryFn: ({ signal }) => getReceiptSummary(filter, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
export const useReceipt = createDetailQuery<PaymentReceipt>(receiptKeys, getReceipt);
export const useRefunds = createListQuery<OrderRefund, ListRefundParams>(refundKeys, listRefunds);
export const useOrderRefund = createDetailQuery<OrderRefund>(refundKeys, getOrderRefund);

/** Các đợt của một đơn (docs 15 §5.2) — khoá riêng dưới root đợt để mọi mutation làm mới cùng lúc. */
export const useOrderInstallments = (orderId: string | null | undefined, enabled = true) =>
  useQuery<OrderInstallments>({
    queryKey: [...installmentKeys.all, "order", orderId ?? ""],
    queryFn: ({ signal }) => getOrderInstallments(orderId ?? "", signal),
    enabled: enabled && !!orderId,
    ...QUERY_TIMES.detail,
  });

/**
 * Các đợt còn nhận tiền của một khách — nguồn chọn dòng cho phiếu thu (BE không lọc nhiều trạng thái
 * một lần nên lấy cả khách rồi chọn đợt `takesMoney` ở `selectors.ts`). Tối đa một trang `size` lớn.
 */
export const usePayableInstallmentsOf = (customerId: string | null | undefined, size: number) =>
  useQuery({
    queryKey: [...installmentKeys.all, "payable-of", customerId ?? "", size],
    queryFn: ({ signal }) =>
      listInstallments(
        { customerId: customerId ?? "", page: 0, size, sort: "dueDate,asc" },
        signal,
      ),
    enabled: !!customerId,
    ...QUERY_TIMES.list,
  });

/** Công nợ theo khách (R5-11). Không thử lại khi 404: BE chưa có endpoint là trạng thái ổn định, trang lùi về đợt. */
export const useReceivables = createListQuery<Receivable, ListReceivableParams>(
  receivableKeys,
  listReceivables,
);
