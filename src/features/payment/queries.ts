import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getInstallment,
  getOrderInstallments,
  getOrderRefund,
  getReceipt,
  listInstallments,
  listReceipts,
  listRefunds,
} from "./api";

import type { ListInstallmentParams, ListReceiptParams, ListRefundParams } from "./api";
import type { Installment, OrderInstallments, OrderRefund, PaymentReceipt } from "./types";

export const installmentKeys = createQueryKeys<ListInstallmentParams>("payment-installments");
export const receiptKeys = createQueryKeys<ListReceiptParams>("payment-receipts");
export const refundKeys = createQueryKeys<ListRefundParams>("payment-refunds");

export const useInstallments = createListQuery<Installment, ListInstallmentParams>(
  installmentKeys,
  listInstallments,
);
export const useInstallment = createDetailQuery<Installment>(installmentKeys, getInstallment);
export const useReceipts = createListQuery<PaymentReceipt, ListReceiptParams>(
  receiptKeys,
  listReceipts,
);
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
