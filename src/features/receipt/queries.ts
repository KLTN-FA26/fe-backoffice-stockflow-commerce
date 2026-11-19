import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getGoodsReceipt, listGoodsReceipts } from "./api";

import type { ListGoodsReceiptParams } from "./api";
import type { GoodsReceipt, GoodsReceiptRow } from "./types";

export const receiptKeys = createQueryKeys<ListGoodsReceiptParams>("goods-receipts");

export const useGoodsReceipts = createListQuery<GoodsReceiptRow, ListGoodsReceiptParams>(
  receiptKeys,
  listGoodsReceipts,
);

export const useGoodsReceipt = createDetailQuery<GoodsReceipt>(receiptKeys, getGoodsReceipt);
