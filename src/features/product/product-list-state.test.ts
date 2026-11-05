import { describe, expect, it } from "vitest";

import { getProductListEmptyState } from "./product-list-state";

describe("product list empty state", () => {
  it("distinguishes an empty catalog from an empty server-filtered result", () => {
    expect(getProductListEmptyState({ itemCount: 0, total: 0, search: "", statusCount: 0 })).toBe(
      "no-products",
    );
    expect(
      getProductListEmptyState({ itemCount: 0, total: 0, search: "chair", statusCount: 0 }),
    ).toBe("no-results");
    expect(getProductListEmptyState({ itemCount: 0, total: 0, search: "", statusCount: 1 })).toBe(
      "no-results",
    );
  });

  it("recognizes an out-of-range page when the server still reports matching records", () => {
    expect(getProductListEmptyState({ itemCount: 0, total: 12, search: "", statusCount: 0 })).toBe(
      "invalid-page",
    );
  });
});
