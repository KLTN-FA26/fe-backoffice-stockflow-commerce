/**
 * Màn chi tiết đơn — thu phần còn lại ON_CREDIT và huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150).
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { apiOrder, apiOrderWith, apiPartialOrder } from "../__fixtures__/order";
import { renderDetail } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — thu phần còn lại ON_CREDIT", () => {
  it("đơn cọc ON_CREDIT: hiện 'Ghi công nợ phần còn lại' và hạn công nợ", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "DEPOSIT", balancePolicy: "ON_CREDIT", creditTermDays: 30 }),
    );
    expect(await screen.findByText("Ghi công nợ phần còn lại")).toBeInTheDocument();
    expect(screen.getByText("30 ngày sau khi giao")).toBeInTheDocument();
  });

  it.each([
    ["BEFORE_DELIVERY", "Chuyển khoản trước khi giao"],
    ["ON_DELIVERY", "Thu hộ khi giao hàng (COD)"],
    ["BRAND_NEW", "Không rõ"],
  ])("balancePolicy %s → %s", async (policy, label) => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "DEPOSIT", balancePolicy: policy }),
    );
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/ngày sau khi giao/)).not.toBeInTheDocument();
  });

  it("đơn không có balancePolicy → không hiện dòng 'Thu phần còn lại'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Thu phần còn lại")).not.toBeInTheDocument();
  });
});

describe("OrderDetail — huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150)", () => {
  const packedAt = "2026-10-22T01:00:00Z";

  it("IN_PRODUCTION có packedAt, chưa lô nào đi → vẫn có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({ status: "IN_PRODUCTION", packedAt }),
    );
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("đã có lô rời kho → không còn nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({
        status: "IN_PRODUCTION",
        packedAt,
        shipments: apiPartialOrder.shipments,
      }),
    );
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });
});
