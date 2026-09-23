import { useMemo } from "react";

import type { OrderColumnSearchKey, OrderSearchField } from "../list-config";
import { ORDER_SEARCH_FIELDS } from "../list-config";

import type { Order } from "../types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

interface FilterOrdersArgs {
  items: Order[] | undefined;
  debouncedQ: string;
  searchFields: OrderSearchField[];
  columnSearch: Partial<Record<OrderColumnSearchKey, string>>;
}

export function useFilteredOrders({
  items,
  debouncedQ,
  searchFields,
  columnSearch,
}: FilterOrdersArgs): Order[] {
  return useMemo(() => {
    let list: Order[] = items ?? [];

    if (debouncedQ.trim() && searchFields.length > 0) {
      const needle = normalize(debouncedQ);
      const getters = new Map(ORDER_SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((order) =>
        searchFields.some((field) => normalize(getters.get(field)?.(order) ?? "").includes(needle)),
      );
    }

    const orderNumberQuery = normalize(columnSearch.orderNumber ?? "");
    if (orderNumberQuery)
      list = list.filter((order) => normalize(order.orderNumber).includes(orderNumberQuery));

    const recipientQuery = normalize(columnSearch.recipientName ?? "");
    if (recipientQuery)
      list = list.filter((order) =>
        normalize(`${order.recipientName} ${order.recipientPhone}`).includes(recipientQuery),
      );

    return list;
  }, [items, debouncedQ, searchFields, columnSearch]);
}
