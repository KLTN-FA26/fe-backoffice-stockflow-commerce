import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { bePage } from "@/test/api-screen";
import { openComboboxList } from "@/test/combobox";

import { apiOrder, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderList } from "./OrderList";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CUSTOMER_UUID = "550e8400-e29b-41d4-a716-446655440000";
const MOC_AN = {
  customerId: CUSTOMER_UUID,
  fullName: "Công ty Mộc An",
  email: "mua@mocan.vn",
  taxCode: "0312345678",
  status: "ACTIVE",
};
/** Sales thấy danh bạ khách (BE `GET /customers` cho SALES_STAFF) — thêm quyền đọc khách vào bộ quyền đơn. */
const SALES_WITH_CUSTOMERS = [...ORDER_PERMISSION_SETS.salesStaff, CUSTOMER_PERMISSIONS.read];

function renderList(
  handler: RouteHandler,
  searchParams = "",
  permissions: readonly PermissionCode[] = SALES_WITH_CUSTOMERS,
) {
  mockOrderApiGet(permissions, {
    "/orders": handler,
    "/customers": () => bePage([MOC_AN]),
    [`/customers/${CUSTOMER_UUID}`]: () => MOC_AN,
  });
  // hasMemory: URL giữ giá trị vừa ghi (mặc định bộ chuyển test trả về URL ban đầu → ô chọn khách tự quay lại giá trị cũ)
  return renderOrderScreen(<OrderList />, searchParams, { hasMemory: true });
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

/**
 * Render danh sách + nhập ô lọc + chờ GET /orders: dưới tải của cả bộ test có lúc vượt 5 giây mặc định
 * (review PR #27) — cùng ngưỡng với các test dialog của đơn hàng.
 */
const FILTER_FLOW_TIMEOUT_MS = 15_000;
const FILTER_SUITE = "OrderList — lọc khách / ngày đặt (URL), đúng hợp đồng BE GET /orders";

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

beforeAll(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (ô chọn khách) dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.restoreAllMocks());

describe(FILTER_SUITE, { timeout: FILTER_FLOW_TIMEOUT_MS }, () => {
  it("URL ?customer(UUID)&from&to → gửi customerId, placedFrom, placedTo; ô hiện TÊN khách, không hiện UUID", async () => {
    renderList(
      () => apiOrderPage([creditOrder]),
      `?customer=${CUSTOMER_UUID}&from=2026-06-01&to=2026-06-30`,
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    const query = lastListQuery();
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
    const box = await screen.findByRole("combobox", { name: "Khách hàng" });
    await waitFor(() => expect(box).toHaveValue("Công ty Mộc An"));
    expect(screen.queryByText(CUSTOMER_UUID)).not.toBeInTheDocument();
    // Thanh Cấu hình cũng ghi tên khách, không ghi UUID
    expect(screen.queryByDisplayValue(CUSTOMER_UUID)).not.toBeInTheDocument();
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

  it("A. chưa lọc → ô chọn khách trống, không gửi customerId, không có ô nhập UUID", async () => {
    renderList(() => apiOrderPage([apiOrder]));

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("");
    expect(screen.queryByLabelText("ID khách hàng")).not.toBeInTheDocument();
    expect(neverSent("customerId")).toBe(true);
  });

  it("B. gõ tên khách → chọn → gửi đúng UUID của khách, về trang 1", async () => {
    const user = userEvent.setup();
    renderList(() => apiOrderPage([apiOrder]), "?page=3");

    const box = await screen.findByRole("combobox", { name: "Khách hàng" });
    await user.type(box, "Mộc");
    await user.click(await screen.findByRole("option", { name: /Công ty Mộc An/ }));

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    expect(lastListQuery().get("page")).toBe("0");
    expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("Công ty Mộc An");
  });

  it("B2. bấm mũi tên → danh sách khách; lọc khách không ép ACTIVE", async () => {
    const user = userEvent.setup();
    renderList(() => apiOrderPage([apiOrder]));

    await openComboboxList(user, "Khách hàng");
    expect(await screen.findByRole("option", { name: /Công ty Mộc An/ })).toBeInTheDocument();
    const call = vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => url === "/customers")
      .at(-1);
    expect((call?.[1] as { params: URLSearchParams }).params.has("status")).toBe(false);
  });

  it("C. ✕ bỏ chọn khách → bỏ customerId khỏi truy vấn", async () => {
    const user = userEvent.setup();
    renderList(() => apiOrderPage([apiOrder]), `?customer=${CUSTOMER_UUID}`);
    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));

    await user.click(await screen.findByRole("button", { name: "Bỏ chọn Khách hàng" }));

    await waitFor(() => expect(lastListQuery().has("customerId")).toBe(false));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue(""),
    );
  });

  it("G. URL mang sẵn customer sai (link cũ CUS-0007) → bỏ qua, KHÔNG gửi BE, không báo lỗi, danh sách vẫn tải", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?customer=CUS-0007");

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Khách hàng" })).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(neverSent("customerId")).toBe(true);
  });

  it("vai trò không có quyền đọc khách (điều phối / kế toán) → không có ô chọn khách; chip Cấu hình ghi tên khách từ dòng đơn, không UUID", async () => {
    renderList(
      () => apiOrderPage([{ ...apiOrder, customerName: "Công ty Bao Bì An Phát" }]),
      `?customer=${apiOrder.customerId}`,
      ORDER_PERMISSION_SETS.salesStaff,
    );

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Khách hàng" })).not.toBeInTheDocument();
    expect(neverSent("customerId")).toBe(false);
    expect(screen.queryByText(String(apiOrder.customerId))).not.toBeInTheDocument();
    expect(await screen.findAllByText(/Công ty Bao Bì An Phát/)).not.toHaveLength(0);
  });

  it("nút lọc ở cột Khách hàng (UUID của BE) → lọc theo khách của dòng", async () => {
    renderList(() => apiOrderPage([apiOrder]));

    await userEvent.click(await screen.findByRole("button", { name: "Lọc đơn của khách này" }));

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

  it("WF-05 BO-08: không còn cột Phương thức TT / Thanh toán (BE không trả trên đơn, luôn '—')", async () => {
    renderList(() => apiOrderPage([creditOrder]));

    expect(await screen.findByText(creditOrder.orderNumber)).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Phương thức TT/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Thanh toán$/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Ghi công nợ")).not.toBeInTheDocument();
  });
});
