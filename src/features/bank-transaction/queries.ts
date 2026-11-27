/** Giao dịch ngân hàng — query hooks. */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getBankTransaction,
  listBankTransactions,
  listCustomerInstallments,
  listMatchingInstallments,
  searchInstallments,
  type ListBankTransactionParams,
} from "./api";

import type { BankTransaction } from "./types";

export const bankTransactionKeys = {
  ...createQueryKeys<ListBankTransactionParams>("bank-transactions"),
  installments: (customerId: string) => ["bank-transactions", "installments", customerId] as const,
  matchingInstallments: (amount: number, customerId: string | null) =>
    ["bank-transactions", "installments", "matching", amount, customerId ?? ""] as const,
  installmentSearch: (search: string) =>
    ["bank-transactions", "installments", "search", search] as const,
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

/** Đợt còn phải thu đúng bằng số tiền giao dịch (của khách nhận ra, hoặc đợt đã đến hạn của mọi khách). */
export function useMatchingInstallments(amount: number, customerId: string | null) {
  return useQuery({
    queryKey: bankTransactionKeys.matchingInstallments(amount, customerId),
    queryFn: ({ signal }) => listMatchingInstallments({ amount, customerId }, signal),
    ...QUERY_TIMES.list,
  });
}

/** Tìm đợt theo số hợp đồng / số đơn khi chưa chọn khách — chỉ khi đã gõ đủ `minLength` ký tự. */
export function useInstallmentSearch(search: string, enabled: boolean) {
  const term = search.trim();
  return useQuery({
    queryKey: bankTransactionKeys.installmentSearch(term),
    queryFn: ({ signal }) => searchInstallments(term, signal),
    enabled: enabled && term.length > 0,
    ...QUERY_TIMES.list,
  });
}
