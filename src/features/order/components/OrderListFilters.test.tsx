import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { apiOrder, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderList } from "./OrderList";

import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderList(handler: RouteHandler, searchParams = "") {
  mockOrderApiGet(ORDER_PERMISSION_SETS.salesStaff, { "/orders": handler });
  return renderOrderScreen(<OrderList />, searchParams);
}

function lastListQuery(): URLSearchParams {
  const calls = vi.mocked(api.get).mock.calls.filter(([url]) => url === "/orders");
  const config = calls.at(-1)?.[1] as { params?: unknown } | undefined;
  return new URLSearchParams(String(config?.params ?? ""));
}

const creditOrder = {
  ...apiOrder,
  paymentTerm: "CREDIT" as const,
  paymentStatus: "ON_CREDIT" as const,
};
const prepaidOrder = {
  ...apiOrder,
  orderId: "1c7a8d2f-5d6e-4a2b-8b88-3f4e7a2e3b21",
  orderNumber: "SO-20260908-000432",
  paymentTerm: "PREPAID" as const,
};

afterEach(() => vi.restoreAllMocks());

describe("OrderList — lọc khách / ngày đặt / phương thức thanh toán (URL)", () => {
  it("URL ?customer&from&to&term → gửi customerId, placedFrom, placedTo, paymentTerm", async () => {
    renderList(
      () => apiOrderPage([creditOrder]),
      "?customer=CUS-0007&from=2026-06-01&to=2026-06-30&term=CREDIT",
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe("CUS-0007"));
    const query = lastListQuery();
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
    expect(query.get("paymentTerm")).toBe("CREDIT");
    expect(await screen.findByLabelText("Mã khách hàng")).toHaveValue("CUS-0007");
  });

  it("khoảng ngày ngược (đến < từ) → báo lỗi inline, KHÔNG gửi placedFrom/placedTo", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?from=2026-06-30&to=2026-06-01");

    expect(await screen.findByRole("alert")).toHaveTextContent("Ngày kết thúc phải sau");
    await waitFor(() =>
      expect(vi.mocked(api.get)).toHaveBeenCalledWith("/orders", expect.anything()),
    );
    expect(lastListQuery().has("placedFrom")).toBe(false);
    expect(lastListQuery().has("placedTo")).toBe(false);
  });

  it("nhập mã khách + Enter → lọc theo khách, về trang 1", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?page=3");

    const input = await screen.findByLabelText("Mã khách hàng");
    await userEvent.type(input, "CUS-0008{Enter}");

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe("CUS-0008"));
    expect(lastListQuery().get("page")).toBe("0");
  });

  it("nút lọc ở cột Khách hàng → lọc theo khách của dòng", async () => {
    renderList(() => apiOrderPage([apiOrder]));

    await userEvent.click(
      await screen.findByRole("button", { name: `Lọc đơn của khách ${apiOrder.customerId}` }),
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(apiOrder.customerId));
  });

  it("CONTRACT PENDING: BE bỏ qua paymentTerm (trả đơn phương thức khác) → cảnh báo chưa lọc", async () => {
    renderList(() => apiOrderPage([creditOrder, prepaidOrder]), "?term=CREDIT");

    expect(
      await screen.findByText(/Máy chủ chưa hỗ trợ lọc theo phương thức thanh toán/),
    ).toBeInTheDocument();
  });

  it("server đã lọc đúng → không cảnh báo", async () => {
    renderList(() => apiOrderPage([creditOrder]), "?term=CREDIT");

    expect(await screen.findByText(creditOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByText(/Máy chủ chưa hỗ trợ lọc/)).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả → 'Bỏ bộ lọc' xoá cả bộ lọc khách / ngày / thanh toán", async () => {
    renderList(() => apiOrderPage([]), "?customer=CUS-X&term=DEPOSIT&from=2026-01-01");

    await userEvent.click(await screen.findByRole("button", { name: "Bỏ bộ lọc" }));

    await waitFor(() => expect(lastListQuery().has("customerId")).toBe(false));
    expect(lastListQuery().has("paymentTerm")).toBe(false);
    expect(lastListQuery().has("placedFrom")).toBe(false);
  });

  it("cột phương thức + trạng thái thanh toán hiển thị nhãn tiếng Việt", async () => {
    renderList(() => apiOrderPage([creditOrder]));

    // Phương thức (Công nợ) khác trạng thái thanh toán (Ghi công nợ) — không trùng nhãn
    expect(await screen.findByText("Công nợ")).toBeInTheDocument();
    expect(screen.getByText("Ghi công nợ")).toBeInTheDocument();
  });
});
