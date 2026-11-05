/**
 * Màn bảng giá khách hàng (chỉ đọc) qua mock adapter thật (route Step 4B): quyền, chọn khách + URL,
 * trạng thái tải / lỗi / rỗng. Chỉ `/identity/me/permissions` được trả tay.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
} from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  OTHER_PRICED_CUSTOMER as B,
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
} from "@/lib/api/mock-customer-price-store";
import { mockCustomerId, resetCustomerMockStore } from "@/lib/api/mock-customer-store";

import { paramsOf, renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { customerPriceKeys } from "../queries";
import { CustomerPriceList } from "./CustomerPriceList";

const L = CUSTOMER_PRICE_UI_LABELS;
const VIEW = CUSTOMER_PRICE_PERMISSIONS.viewPage;
const READ = CUSTOMER_PRICE_PERMISSIONS.read;
const LOOKUP = CUSTOMER_PERMISSIONS.read;
const ALL = [VIEW, READ, LOOKUP];
const PRICES = "/catalog/customer-prices";
const MISSING = "c0de9999-0000-4000-8000-000000009999";

// Mỗi request mock trễ ~350ms (Math.random = 0.5 → không có lỗi 500 ngẫu nhiên).
vi.setConfig({ testTimeout: 30_000 });
const WAIT = { timeout: 5_000 };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
});
afterEach(() => vi.restoreAllMocks());

const render = (search = "") => renderCustomerPrices(<CustomerPriceList />, search);
const calledWith = (get: ReturnType<typeof stubPermissions>, url: string) =>
  get.mock.calls.filter(([u]) => u === url);
const sku = (code: string) => screen.findByText(code, {}, WAIT);

async function pickCustomer(search: string, name: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("combobox", { name: L.picker.label }));
  await user.type(screen.getByRole("combobox", { name: L.picker.label }), search);
  await user.click(await screen.findByRole("option", { name }, WAIT));
  return user;
}

describe("quyền", () => {
  it("1 thiếu VIEW_PAGE → chặn trang, không gọi API giá / khách", async () => {
    const get = stubPermissions([READ, LOOKUP]);
    render(`customerId=${A}`);
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(calledWith(get, PRICES)).toHaveLength(0);
    expect(get.mock.calls.some(([u]) => String(u).startsWith("/customers"))).toBe(false);
  });

  it("2 VIEW_PAGE không có READ giá → không gọi API giá", async () => {
    const get = stubPermissions([VIEW, LOOKUP]);
    render(`customerId=${A}`);
    expect(await screen.findByText(L.table.readDenied)).toBeInTheDocument();
    expect(calledWith(get, PRICES)).toHaveLength(0);
  });

  it("3 VIEW_PAGE + READ → hiện bảng giá", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    expect(await sku("SKU-001-BLK-L")).toBeInTheDocument();
  });

  it("4 thiếu quyền tra khách → không có ô chọn, không gọi /customers", async () => {
    const get = stubPermissions([VIEW, READ]);
    render();
    expect(await screen.findByText(L.customer.noSelectionRestricted)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: L.picker.label })).toBeNull();
    expect(get.mock.calls.some(([u]) => String(u).startsWith("/customers"))).toBe(false);
  });

  it("5 có READ giá, thiếu quyền tra khách: link có customerId vẫn xem được giá, chỉ hiện id", async () => {
    const get = stubPermissions([VIEW, READ]);
    render(`customerId=${A}`);
    expect(await sku("SKU-002-WHT")).toBeInTheDocument();
    expect(screen.getByText(L.customer.noLookupPermission)).toBeInTheDocument();
    expect(screen.getAllByText(A).length).toBeGreaterThan(0);
    expect(get.mock.calls.some(([u]) => String(u).startsWith("/customers"))).toBe(false);
  });
});

describe("chọn khách + URL", () => {
  it("6 + 10 chọn khách: tìm qua q (BE), cập nhật URL, tải đúng giá", async () => {
    const get = stubPermissions(ALL);
    const view = render();
    await pickCustomer("khach1@", /In Ấn Sài Gòn/);
    await waitFor(() => expect(view.urlUpdates.at(-1)).toBe(`?customerId=${A}`));
    expect(await sku("SKU-003-WHT-L")).toBeInTheDocument();
    const searches = calledWith(get, "/customers").map(([, config]) => paramsOf(config).get("q"));
    expect(searches).toContain("khach1@");
  });

  it("7 link trực tiếp → đúng khách, đúng giá; UUID chữ hoa cũng được (gọi bằng chữ thường)", async () => {
    const get = stubPermissions(ALL);
    render(`customerId=${A.toUpperCase()}`);
    expect(await sku("SKU-001-BLK-L")).toBeInTheDocument();
    expect(paramsOf(calledWith(get, PRICES)[0]?.[1]).get("customerId")).toBe(A);
  });

  it("8 Back / Forward (URL đổi từ ngoài) đổi khách đang xem", async () => {
    stubPermissions(ALL);
    const view = render();
    view.navigate(`customerId=${A}`);
    expect(await sku("SKU-002-WHT")).toBeInTheDocument();
    view.navigate(`customerId=${B}`);
    await waitFor(() => expect(screen.queryByText("SKU-002-WHT")).toBeNull(), WAIT);
    expect(await sku("SKU-001-BLK-L")).toBeInTheDocument();
    view.navigate(`customerId=${A}`);
    expect(await sku("SKU-002-WHT")).toBeInTheDocument();
  });

  it("9 bỏ chọn → xoá customerId khỏi URL", async () => {
    stubPermissions(ALL);
    const view = render(`customerId=${A}`);
    await sku("SKU-001-BLK-L");
    await userEvent.setup().click(screen.getByRole("button", { name: L.customer.clear }));
    await waitFor(() => expect(view.urlUpdates.at(-1)).toBe(""));
    expect(await screen.findByText(L.customer.noSelection)).toBeInTheDocument();
  });

  it("11 khách nhiều trang: có 'Trang sau', gọi page=1 và hiện khách khác", async () => {
    const get = stubPermissions(ALL);
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("combobox", { name: L.picker.label }));
    const firstPage = await screen.findAllByRole("option", {}, WAIT);
    await user.click(await screen.findByRole("option", { name: L.picker.next }));
    await screen.findByText(L.picker.pageInfo(2, 45), {}, WAIT);
    expect(calledWith(get, "/customers").some(([, c]) => paramsOf(c).get("page") === "1")).toBe(
      true,
    );
    const secondPage = screen.getAllByRole("option").map((o) => o.textContent);
    expect(secondPage).not.toEqual(firstPage.map((o) => o.textContent));
    expect(screen.getByRole("option", { name: L.picker.previous })).toBeInTheDocument();
  });

  it("12 + 13 hiện trạng thái khách; khách BLOCKED / INACTIVE không bị loại, chọn được, có cảnh báo", async () => {
    stubPermissions(ALL);
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("combobox", { name: L.picker.label }));
    await user.type(screen.getByRole("combobox", { name: L.picker.label }), "khach5@");
    expect(
      await screen.findByRole("option", { name: /Ngừng hoạt động/ }, WAIT),
    ).toBeInTheDocument();
    await user.clear(screen.getByRole("combobox", { name: L.picker.label }));
    await user.type(screen.getByRole("combobox", { name: L.picker.label }), "khach7@");
    await user.click(await screen.findByRole("option", { name: /Bị khoá/ }, WAIT));
    expect(await screen.findByText(L.customer.statusWarning, {}, WAIT)).toBeInTheDocument();
  });
});

describe("trạng thái", () => {
  it("27 chưa chọn khách", async () => {
    stubPermissions(ALL);
    render();
    expect(await screen.findByText(L.customer.noSelection)).toBeInTheDocument();
  });

  it("customerId sai dạng → báo, không gọi API giá", async () => {
    const get = stubPermissions(ALL);
    render("customerId=CUS-0012");
    expect(await screen.findByText(L.customer.invalidId)).toBeInTheDocument();
    expect(calledWith(get, PRICES)).toHaveLength(0);
  });

  it("28 khách chưa có giá → trạng thái riêng, không phải lỗi", async () => {
    stubPermissions(ALL);
    render(`customerId=${C}`);
    expect(await screen.findByText(L.table.noPrices, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("29 khách không tồn tại → báo không tìm thấy (ở cả thẻ khách lẫn bảng giá)", async () => {
    stubPermissions(ALL);
    render(`customerId=${MISSING}`);
    await waitFor(() => expect(screen.getAllByText(L.customer.notFound)).toHaveLength(2), WAIT);
    expect(screen.queryByText(L.table.noPrices)).toBeNull();
  });

  it("30 lỗi máy chủ → báo + Thử lại; thử lại thành công hiện bảng", async () => {
    let fail = true;
    stubPermissions(ALL, (url) =>
      url === PRICES && fail
        ? Promise.reject(new ApiError(500, "INTERNAL_ERROR", "boom"))
        : undefined,
    );
    render(`customerId=${A}`);
    const alert = await screen.findByRole("alert", {}, WAIT);
    expect(alert).toHaveTextContent(L.table.loadFailed);
    expect(screen.queryByText(L.table.noPrices)).toBeNull();
    fail = false;
    await userEvent.setup().click(within(alert).getByRole("button", { name: L.table.retry }));
    expect(await sku("SKU-001-BLK-L")).toBeInTheDocument();
  });

  it("31 tải lại nền lỗi → giữ bảng đã có, chỉ báo", async () => {
    let fail = false;
    stubPermissions(ALL, (url) =>
      url === PRICES && fail ? Promise.reject(new ApiError(503, "UNAVAILABLE", "down")) : undefined,
    );
    const view = render(`customerId=${A}`);
    await sku("SKU-001-BLK-L");
    fail = true;
    await view.client.refetchQueries({ queryKey: customerPriceKeys.lists(A) });
    expect(await screen.findByText(L.table.refreshFailed, {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("SKU-001-BLK-L")).toBeInTheDocument();
  });

  it("lỗi tra khách không che bảng giá tải được độc lập", async () => {
    stubPermissions(ALL, (url) =>
      url === `/customers/${A}`
        ? Promise.reject(new ApiError(500, "INTERNAL_ERROR", "boom"))
        : undefined,
    );
    render(`customerId=${A}`);
    expect(await sku("SKU-001-BLK-L")).toBeInTheDocument();
    expect(await screen.findByText(L.customer.failed, {}, WAIT)).toBeInTheDocument();
  });

  it("khách INACTIVE mở bằng link vẫn xem được, có cảnh báo", async () => {
    stubPermissions(ALL);
    render(`customerId=${mockCustomerId(5)}`);
    expect(await screen.findByText(L.customer.statusWarning, {}, WAIT)).toBeInTheDocument();
  });
});

/**
 * Tích hợp develop (Step 6C): `InputCombobox` giờ bấm Enter khi chưa có mục nào được đánh dấu thì chọn MỤC
 * ĐẦU. Ô chọn khách giữ kết quả cũ trong lúc chờ debounce / tải `q` mới → Enter không được chọn nhầm khách
 * của lần tìm trước; chỉ chọn khi danh sách đúng là kết quả của chữ đang gõ.
 */
describe("Enter trong ô chọn khách sau khi tích hợp develop", () => {
  it("gõ từ khoá mới rồi Enter ngay → không chọn khách của kết quả cũ; có kết quả mới thì Enter chọn đúng", async () => {
    stubPermissions(ALL);
    const view = render();
    const user = userEvent.setup();
    const box = await screen.findByRole("combobox", { name: L.picker.label });
    await user.click(box);
    // kết quả của từ khoá rỗng (trang đầu mọi khách) đã hiện
    await screen.findAllByRole("option", {}, WAIT);
    await user.type(box, "khach1@");
    await user.keyboard("{Enter}");
    expect(view.urlUpdates).toEqual([]);

    // kết quả của "khach1@" về → Enter chọn đúng khách đó
    await screen.findByRole("option", { name: /In Ấn Sài Gòn/ }, WAIT);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /In Ấn Sài Gòn/ })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await user.keyboard("{Enter}");
    await waitFor(() => expect(view.urlUpdates.at(-1)).toBe(`?customerId=${A}`));
  });
});
