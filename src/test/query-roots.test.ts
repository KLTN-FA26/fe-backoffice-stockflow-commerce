import { describe, expect, it } from "vitest";

import { customerKeys } from "@/features/customer/queries";
import { myOrderKeys } from "@/features/customer-order/queries";
import { fulfillmentKeys } from "@/features/fulfillment/queries";
import { stockKeys, stockReservationKeys } from "@/features/inventory/queries";
import { orderKeys } from "@/features/order/queries";
import { installmentKeys, refundKeys } from "@/features/payment/queries";
import { quoteKeys } from "@/features/quote/queries";

import { QUERY_ROOTS } from "@/lib/api/query-roots";

describe("QUERY_ROOTS match the owning features' key factories (cross-feature invalidation)", () => {
  it.each([
    ["customers", customerKeys.all],
    ["quotes", quoteKeys.all],
    ["orders", orderKeys.all],
    ["myOrders", myOrderKeys.all],
    ["fulfillmentTasks", fulfillmentKeys.all],
    ["inventoryStock", stockKeys.all],
    ["inventoryReservations", stockReservationKeys.all],
    ["paymentRefunds", refundKeys.all],
    ["paymentInstallments", installmentKeys.all],
  ] as const)("%s", (root, keys) => {
    expect(QUERY_ROOTS[root]).toEqual(keys);
  });
});
