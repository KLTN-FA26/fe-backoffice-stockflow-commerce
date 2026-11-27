import { screen, waitFor, within } from "@testing-library/react";
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
 * Render danh sách + nhập ô lọc + chờ GET /orders: dưới tải của cả bộ test có lúc vượt 5 giây mặc định
 * (review PR #27) — cùng ngưỡng với các test dialog của đơn hàng.
 */
const FILTER_FLOW_TIMEOUT_MS = 15_000;
const FILTER_SUITE = "OrderList — lọc khách / ngày đặt (URL), đúng hợp đồng BE GET /orders";

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

/** Ô ID khách nằm trong popover lọc của header cột Khách hàng (backoffice-erp-ui A5): mở rồi trả về ô nhập. */
async function customerInput() {
  await userEvent.click(await screen.findByRole("button", { name: "Lọc khách hàng" }));
  return screen.findByLabelText("ID khách hàng");
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

describe(FILTER_SUITE, { timeout: FILTER_FLOW_TIMEOUT_MS }, () => {
  it("URL ?customer(UUID)&from&to → gửi customerId, placedFrom, placedTo", async () => {
    renderList(
      () => apiOrderPage([creditOrder]),
      `?customer=${CUSTOMER_UUID}&from=2026-06-01&to=2026-06-30`,
    );

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    const query = lastListQuery();
    expect(query.get("placedFrom")).toBe("2026-06-01");
    expect(query.get("placedTo")).toBe("2026-06-30");
    expect(await customerInput()).toHaveValue(CUSTOMER_UUID);
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
  });

  it("khoảng ngày ngược (đến < từ) trên link → báo lỗi trên bảng, KHÔNG gửi placedFrom/placedTo", async () => {
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
    const input = await customerInput();
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(neverSent("customerId")).toBe(true);
  });

  it("B. nhập UUID hợp lệ + Enter → gửi đúng UUID, về trang 1, không lỗi", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?page=3");

    const input = await customerInput();
    await fill(input, CUSTOMER_UUID);
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));
    expect(lastListQuery().get("page")).toBe("0");
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
  });

  it("C. nhập CUS-0007 + Enter → lỗi inline, KHÔNG gọi BE với customerId, danh sách vẫn hiện", async () => {
    renderList(() => apiOrderPage([apiOrder]));
    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    const input = await customerInput();
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
    const input = await customerInput();

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
    const input = await customerInput();

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
    const input = await customerInput();
    await waitFor(() => expect(lastListQuery().get("customerId")).toBe(CUSTOMER_UUID));

    await userEvent.clear(input);
    await userEvent.type(input, "CUS-0007{Enter}");
    expect(await screen.findByText(INVALID_MESSAGE)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");

    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    await waitFor(() => expect(lastListQuery().has("customerId")).toBe(false));
  });

  it("G. URL mang sẵn customer sai (link cũ) → báo trên bảng + lỗi ở ô, KHÔNG gửi BE, danh sách vẫn tải", async () => {
    renderList(() => apiOrderPage([apiOrder]), "?customer=CUS-0007");

    expect(await screen.findByText(apiOrder.orderNumber)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("không phải UUID");
    expect(await customerInput()).toHaveValue("CUS-0007");
    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(neverSent("customerId")).toBe(true);
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

describe(
  "OrderList — lọc / sắp xếp trên header cột (backoffice-erp-ui A5)",
  { timeout: FILTER_FLOW_TIMEOUT_MS },
  () => {
    const other = {
      ...apiOrder,
      orderId: "2c7a8d2f-5d6e-4a2b-8b88-3f4e7a2e3b22",
      orderNumber: "SO-20260908-000999",
    };

    it("lọc cột Mã đơn: BE thu hẹp bằng search, FE giữ đúng dòng khớp mã, chip 'Search trong cột'", async () => {
      renderList(() => apiOrderPage([apiOrder, other]));
      await screen.findByText(other.orderNumber);
      await userEvent.click(screen.getByRole("button", { name: "Lọc mã đơn" }));
      await userEvent.type(screen.getByPlaceholderText("Tìm theo mã đơn…"), "000999");
      await waitFor(() => expect(lastListQuery().get("search")).toBe("000999"), { timeout: 3000 });
      await waitFor(() => expect(screen.queryByText(apiOrder.orderNumber)).not.toBeInTheDocument());
      expect(screen.getByText(other.orderNumber)).toBeInTheDocument();
      expect(screen.getByText(/Mã đơn “000999”/)).toBeInTheDocument();
    });

    it("lọc khoảng Tổng tiền (BE không có tham số) → chỉ lọc trang đang xem, không gửi BE", async () => {
      renderList(() =>
        apiOrderPage([apiOrder, { ...other, totalAmount: apiOrder.totalAmount + 1 }]),
      );
      await screen.findByText(other.orderNumber);
      await userEvent.click(screen.getByRole("button", { name: "Lọc tổng tiền" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Từ — tổng tiền" }),
        String(apiOrder.totalAmount + 1),
      );
      await waitFor(() => expect(screen.queryByText(apiOrder.orderNumber)).not.toBeInTheDocument());
      expect(screen.getByText(other.orderNumber)).toBeInTheDocument();
      expect(listQueries().every((q) => ![...q.keys()].some((k) => /total/i.test(k)))).toBe(true);
    });

    it("lọc cột Trạng thái trên header → gửi status lặp tham số (chọn nhiều)", async () => {
      renderList(() => apiOrderPage([apiOrder]));
      await screen.findByText(apiOrder.orderNumber);
      const statusHeader = screen.getByRole("columnheader", { name: /Trạng thái/ });
      await userEvent.click(within(statusHeader).getByRole("button", { name: "Lọc trạng thái" }));
      await userEvent.click(await screen.findByRole("option", { name: /Nháp/ }));
      await waitFor(() => expect(lastListQuery().getAll("status")).toEqual(["DRAFT"]));
    });

    it("Khách hàng / Người nhận không có nút sắp xếp (BE LIST_SORT không có); Mã đơn có", async () => {
      renderList(() => apiOrderPage([apiOrder]));
      await screen.findByText(apiOrder.orderNumber);
      // Nhãn cột là nút sort; cột BE không sort được thì nút bị khoá
      const label = (name: string) =>
        within(screen.getByRole("columnheader", { name: new RegExp(name) })).getByRole("button", {
          name,
        });
      expect(label("Mã đơn")).toBeEnabled();
      expect(label("Ngày đặt")).toBeEnabled();
      expect(label("Tổng tiền")).toBeEnabled();
      // Mọi cột dữ liệu đều có nút lọc trên header
      for (const name of [
        "Mã đơn",
        "Khách hàng",
        "Người nhận",
        "Ngày đặt",
        "Tổng tiền",
        "Trạng thái",
      ]) {
        const header = screen.getByRole("columnheader", { name: new RegExp(name) });
        expect(within(header).getByRole("button", { name: /^Lọc / })).toBeInTheDocument();
      }
      expect(label("Khách hàng")).toBeDisabled();
      expect(label("Người nhận")).toBeDisabled();
    });
  },
);
