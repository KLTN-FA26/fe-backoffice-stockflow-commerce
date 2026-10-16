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

function listQueries(): URLSearchParams[] {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === "/orders")
    .map(
      ([, config]) => new URLSearchParams(String((config as { params?: unknown })?.params ?? "")),
    );
}

function lastListQuery(): URLSearchParams {
  return listQueries().at(-1) ?? new URLSearchParams();
}

/** Không lần gọi GET /orders nào mang tham số `key`. */
function neverSent(key: string): boolean {
  return listQueries().every((query) => !query.has(key));
}

const CUSTOMER_UUID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Nhập cả chuỗi bằng paste thay vì gõ từng phím (36 ký tự UUID) — cùng sự kiện onChange, nhưng
 * không phụ thuộc tải máy khi chạy song song cả bộ test (như `cancelWith` của OrderDetail).
 */
async function fill(input: HTMLElement, value: string) {
  await userEvent.clear(input);
  await userEvent.click(input);
  await userEvent.paste(value);
}
const INVALID_MESSAGE = "ID khách hàng phải là UUID hợp lệ.";

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

describe("OrderList — lọc khách / ngày đặt (URL), đúng hợp đồng BE GET /orders", () => {
  it("URL ?customer(UUID)&from&to → gửi customerId, placedFrom, placedTo", async () => {
    renderList(
      () => apiOrderPage([creditOrder]),
      `?customer=${CUSTOMER_UUID}&from=2026-06-01&to=2026-06-30`,
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    const query = lastListQuery();
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
    expect(await screen.findByLabelText("ID khách hàng")).toHaveValue(CUSTOMER_UUID);
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
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

  it("A. ô ID khách rỗng → không lỗi, không gửi customerId", async () => {
    renderList(() => apiOrderPage([apiOrder]));

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByLabelText("ID khách hàng")).toHaveValue("");
    expect(screen.getByLabelText("ID khách hàng")).not.toHaveAttribute("aria-invalid");
    expect(neverSent("customerId")).toBe(true);
  });

  it("B. nhập UUID hợp lệ + Enter → gửi đúng UUID, về trang 1, không lỗi", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?page=3");

    const input = await screen.findByLabelText("ID khách hàng");
    await fill(input, CUSTOMER_UUID);
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    expect(lastListQuery().get("page")).toBe("0");
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
  });

  it("C. nhập CUS-0007 + Enter → lỗi inline, KHÔNG gọi BE với customerId, danh sách vẫn hiện", async () => {
    renderList(() => apiOrderPage([apiOrder]));
    const input = await screen.findByLabelText("ID khách hàng");
    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    const callsBefore = listQueries().length;

    await userEvent.type(input, "CUS-0007{Enter}");

    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveValue("CUS-0007");
    // Không gọi lại API, không có customerId; danh sách không thành màn lỗi
    expect(listQueries()).toHaveLength(callsBefore);
    expect(neverSent("customerId")).toBe(true);
    expect(screen.getByText(apiOrder.orderNumber)).toBeInTheDocument();
  });

  it("D. UUID sai dạng (thiếu ký tự / không gạch / ký tự lạ) → bị từ chối", async () => {
    renderList(() => apiOrderPage([apiOrder]));
    const input = await screen.findByLabelText("ID khách hàng");

    for (const bad of [
      "550e8400-e29b-41d4-a716-44665544000",
      "550e8400e29b41d4a716446655440000",
      "zzze8400-e29b-41d4-a716-446655440000",
      "12345",
    ]) {
      await fill(input, bad);
      await userEvent.keyboard("{Enter}");
      expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();
    }
    expect(neverSent("customerId")).toBe(true);
  });

  it("E. sai → sửa thành UUID hợp lệ → hết lỗi, bộ lọc được áp", async () => {
    renderList(() => apiOrderPage([apiOrder]));
    const input = await screen.findByLabelText("ID khách hàng");

    await userEvent.type(input, "abc{Enter}");
    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();

    await fill(input, CUSTOMER_UUID);
    // Kiểm lại theo phím: lỗi tắt ngay khi giá trị hợp lệ
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("F. sai → xoá trống → hết lỗi, bỏ bộ lọc khách", async () => {
    renderList(() => apiOrderPage([apiOrder]), `?customer=${CUSTOMER_UUID}`);
    const input = await screen.findByLabelText("ID khách hàng");
    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));

    await userEvent.clear(input);
    await userEvent.type(input, "CUS-0007{Enter}");
    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");

    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    await waitFor(() => expect(lastListQuery().has("customerId")).toBe(false));
  });

  it("G. URL mang sẵn customer sai (link cũ) → hiện lỗi ở ô, KHÔNG gửi BE, danh sách vẫn tải", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?customer=CUS-0007");

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByLabelText("ID khách hàng")).toHaveValue("CUS-0007");
    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(neverSent("customerId")).toBe(true);
  });

  it("nút lọc ở cột Khách hàng (UUID của BE) → lọc theo khách của dòng", async () => {
    renderList(() => apiOrderPage([apiOrder]));

    await userEvent.click(
      await screen.findByRole("button", { name: `Lọc đơn của khách ${apiOrder.customerId}` }),
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(apiOrder.customerId));
  });

  it("id khách không phải UUID (vd dữ liệu mock) → không có nút lọc nhanh ở cột", async () => {
    renderList(() => apiOrderPage([{ ...apiOrder, customerId: "CUS-0001" }]));

    expect(await screen.findByText("CUS-0001")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lọc đơn của khách CUS-0001" }),
    ).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả → 'Bỏ bộ lọc' xoá cả bộ lọc khách / ngày", async () => {
    renderList(() => apiOrderPage([]), `?customer=${CUSTOMER_UUID}&from=2026-01-01`);

    await userEvent.click(await screen.findByRole("button", { name: "Bỏ bộ lọc" }));

    await waitFor(() => expect(lastListQuery().has("customerId")).toBe(false));
    expect(lastListQuery().has("placedFrom")).toBe(false);
  });
});

describe("OrderList — KHÔNG có bộ lọc phương thức thanh toán (BE GET /orders chưa hỗ trợ)", () => {
  it("H. hàng bộ lọc không có ô phương thức thanh toán, không có ghi chú 'chờ máy chủ'", async () => {
    renderList(() => apiOrderPage([creditOrder, prepaidOrder]));

    expect(await screen.findByText(creditOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByLabelText("Phương thức thanh toán")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tất cả phương thức/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chờ máy chủ hỗ trợ/)).not.toBeInTheDocument();
  });

  it("J. link cũ ?term=CREDIT / ?paymentTerm=NET_30 → bị bỏ qua, GET /orders không có paymentTerm", async () => {
    renderList(() => apiOrderPage([creditOrder, prepaidOrder]), "?term=CREDIT&paymentTerm=NET_30");

    // Không lọc: cả đơn công nợ lẫn trả trước đều hiện
    expect(await screen.findByText(creditOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(prepaidOrder.orderNumber)).toBeInTheDocument();
    expect(neverSent("paymentTerm")).toBe(true);
    expect(neverSent("term")).toBe(true);
  });

  it("cột phương thức + trạng thái thanh toán hiển thị nhãn tiếng Việt", async () => {
    renderList(() => apiOrderPage([creditOrder]));

    // Phương thức (Công nợ) khác trạng thái thanh toán (Ghi công nợ) — không trùng nhãn
    expect(await screen.findByText("Công nợ")).toBeInTheDocument();
    expect(screen.getByText("Ghi công nợ")).toBeInTheDocument();
  });
});
