import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getMyOrder, listMyOrders } from "./api";

import type { ListMyOrderParams } from "./api";
import type { MyOrderCard, MyOrderDetail } from "./schemas";

export const myOrderKeys = createQueryKeys<ListMyOrderParams>("my-orders");

export const useMyOrders = createListQuery<MyOrderCard, ListMyOrderParams>(
  myOrderKeys,
  listMyOrders,
);
export const useMyOrder = createDetailQuery<MyOrderDetail>(myOrderKeys, getMyOrder);
