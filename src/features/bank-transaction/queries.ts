/** Giao dịch ngân hàng — query hooks. */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getBankTransaction,
  listBankTransactions,
  listCustomerInstallments,
  listOwingInstallments,
  type ListBankTransactionParams,
} from "./api";

import type { BankTransaction } from "./types";

export const bankTransactionKeys = {
  ...createQueryKeys<ListBankTransactionParams>("bank-transactions"),
  installments: (customerId: string) => ["bank-transactions", "installments", customerId] as const,
  owingInstallments: () => ["bank-transactions", "installments", "owing"] as const,
};

export const useBankTransactions = createListQuery<BankTransaction, ListBankTransactionParams>(
  bankTransactionKeys,
  listBankTransactions,
);

export const useBankTransaction = createDetailQuery<BankTransaction>(
  bankTransactionKeys,
  getBankTransaction,
);

/** Đợt của khách để gán — chỉ khi form đang mở và đã chọn khách. */
export function useCustomerInstallments(customerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: bankTransactionKeys.installments(customerId ?? ""),
    queryFn: ({ signal }) => listCustomerInstallments(customerId ?? "", signal),
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.list,
  });
}

/** Đợt đã đến hạn còn phải thu của mọi khách — gợi ý đợt cùng số tiền khi giao dịch không nhận ra khách. */
export function useOwingInstallments(enabled: boolean) {
  return useQuery({
    queryKey: bankTransactionKeys.owingInstallments(),
    queryFn: ({ signal }) => listOwingInstallments(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}
