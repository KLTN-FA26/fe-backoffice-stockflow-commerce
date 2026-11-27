/**
 * Màn chi tiết đơn — khối Thanh toán bỏ các field thu phần còn lại BE đã xoá, và huỷ đơn khi hàng có sẵn đã đóng trước
 * hàng in (BE PR #150).
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { apiOrder, apiOrderWith, apiPartialOrder } from "../__fixtures__/order";
import { renderDetail } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS, orderAction, orderActionOrNull } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — khối Thanh toán không đọc field BE đã bỏ (paymentTerm / balancePolicy / creditTermDays)", () => {
  it.each([
    ["ON_CREDIT", "Ghi công nợ phần còn lại"],
    ["BEFORE_DELIVERY", "Chuyển khoản trước khi giao"],
    ["ON_DELIVERY", "Thu hộ khi giao hàng (COD)"],
  ])("response cũ mang balancePolicy %s → không hiện '%s' / hạn công nợ", async (policy, label) => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "DEPOSIT", balancePolicy: policy, creditTermDays: 30 }),
    );
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByText("Thu phần còn lại")).not.toBeInTheDocument();
    expect(screen.queryByText(/ngày sau khi giao/)).not.toBeInTheDocument();
  });
});

describe("OrderDetail — huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150)", () => {
  const packedAt = "2026-10-22T01:00:00Z";

  it("IN_PRODUCTION có packedAt, chưa lô nào đi → vẫn có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({ status: "IN_PRODUCTION", packedAt }),
    );
    expect(await orderAction("Huỷ đơn")).toBeInTheDocument();
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
    expect(await orderActionOrNull("Huỷ đơn")).toBeNull();
  });
});
