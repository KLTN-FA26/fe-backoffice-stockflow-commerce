import { describe, expect, it } from "vitest";

import { customerKeys } from "@/features/customer/queries";
import { myOrderKeys } from "@/features/customer-order/queries";
import { fulfillmentKeys } from "@/features/fulfillment/queries";
import { orderKeys } from "@/features/order/queries";
import { productionKeys } from "@/features/production-order/queries";
import { quoteKeys } from "@/features/quote/queries";
import { sampleKeys } from "@/features/sample-request/queries";

import { QUERY_ROOTS } from "@/lib/api/query-roots";

describe("QUERY_ROOTS match the owning features' key factories (cross-feature invalidation)", () => {
  it.each([
    ["customers", customerKeys.all],
    ["quotes", quoteKeys.all],
    ["sampleRequests", sampleKeys.all],
    ["productionOrders", productionKeys.all],
    ["orders", orderKeys.all],
    ["myOrders", myOrderKeys.all],
    ["fulfillmentTasks", fulfillmentKeys.all],
  ] as const)("%s", (root, keys) => {
    expect(QUERY_ROOTS[root]).toEqual(keys);
  });
});
