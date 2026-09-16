import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getReceipt, listReceiptLots, listReceipts, type ListReceiptParams } from "./api";

import type { Lot, Receipt } from "./types";

export const receiptKeys = createQueryKeys<ListReceiptParams>("receipts");
export const receiptLotKeys = createQueryKeys<Record<string, unknown>>("receipt-lots");

export const useReceipts = createListQuery<Receipt, ListReceiptParams>(receiptKeys, listReceipts);
export const useReceipt = createDetailQuery<Receipt>(receiptKeys, getReceipt);
export const useReceiptLots = createListQuery<Lot, Record<string, unknown>>(
  receiptLotKeys,
  (_, signal) => listReceiptLots(signal),
);
