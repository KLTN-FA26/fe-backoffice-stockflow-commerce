import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { VariantInventorySummary } from "./VariantInventorySummary";

const { useSummaryMock } = vi.hoisted(() => ({ useSummaryMock: vi.fn() }));
vi.mock("@/lib/references/inventory-item-lookup", () => ({
  useInventoryItemSummary: useSummaryMock,
}));

const S = UI_LABELS.inventoryItem.variantSummary;
const failWith = (error: unknown) =>
  useSummaryMock.mockReturnValue({ isPending: false, isError: true, error, data: undefined });

beforeEach(() => useSummaryMock.mockReset());

// Lỗi tải hồ sơ hàng tồn (BE PR #119 `GET /inventory/items/{id}`) — câu riêng, không dùng câu lỗi biến thể.
describe("VariantInventorySummary — lỗi tải hồ sơ hàng tồn", () => {
  it.each([
    [
      "404 INVENTORY_ITEM_NOT_FOUND",
      new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "x"),
      S.notFound,
    ],
    ["403", new ApiError(403, "FORBIDDEN", "x"), S.forbidden],
    ["500", new ApiError(500, "INTERNAL", "x"), S.loadFailed],
    ["lỗi không rõ", new Error("boom"), S.loadFailed],
  ])("%s → câu tiếng Việt đúng loại", (_, error, message) => {
    failWith(error);
    render(<VariantInventorySummary inventoryItemId="item-1" canRead />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });
});
