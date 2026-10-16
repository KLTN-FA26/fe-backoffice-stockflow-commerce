import { LOAD_STATUS, SHIPPING_LIMITS } from "@/constants";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getLoad, listLoads } from "./api";

import type { ListLoadParams } from "./api";
import type { Load, LoadRow } from "./types";

export const loadKeys = createQueryKeys<ListLoadParams>("fulfillment-loads");

export const useLoads = createListQuery<LoadRow, ListLoadParams>(loadKeys, listLoads);

export const useLoad = createDetailQuery<Load>(loadKeys, getLoad);

/**
 * Chi tiết chuyến cho màn biên bản: đang xếp hàng (LOADING) thì tự tải lại định kỳ — kiện quét từ
 * máy khác hiện ra và nút bàn giao tự mở khi đủ kiện, không cần F5. Chuyến khác trạng thái thì thôi.
 */
export const useLoadPolling = createDetailQuery<Load>(loadKeys, getLoad, {
  refetchInterval: (query) =>
    query.state.data?.status === LOAD_STATUS.LOADING ? SHIPPING_LIMITS.manifestPollMs : false,
});
