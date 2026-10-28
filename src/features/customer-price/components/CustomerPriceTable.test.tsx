/**
 * Bảng giá của khách (chỉ đọc) qua mock adapter thật: dòng đúng khách, phân trang + lọc phía FE, giá
 * thấp / cao nhất qua mọi bậc, cảnh báo độ chính xác, bảng chi tiết bậc giá.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
} from "@/constants";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  OTHER_PRICED_CUSTOMER as B,
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
  seedMockCustomerPrice,
} from "@/lib/api/mock-customer-price-store";
import { mockCustomerId, resetCustomerMockStore } from "@/lib/api/mock-customer-store";

import { passThrough, renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { CustomerPriceList } from "./CustomerPriceList";

import type { MockTier } from "@/lib/api/mock-customer-price-store";

const L = CUSTOMER_PRICE_UI_LABELS;
const T = L.table;
const ALL = [
  CUSTOMER_PRICE_PERMISSIONS.viewPage,
  CUSTOMER_PRICE_PERMISSIONS.read,
  CUSTOMER_PERMISSIONS.read,
];
const D = mockCustomerId(4);

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
const tiers = (...pairs: [number, string][]): MockTier[] =>
  pairs.map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice }));
/** 12 giá cho một khách → 2 trang ở cỡ 10. */
function seedTwelve(customerId: string, prefix: string) {
  for (let i = 1; i <= 12; i += 1) {
    seedMockCustomerPrice({
      customerId,
      sku: `${prefix}-${String(i).padStart(2, "0")}`,
      tiers: tiers([1, String(1000 * i)]),
      note: null,
      version: 0,
    });
  }
}
const table = () => screen.findByRole("table", {}, WAIT);
const rowOf = async (sku: string) => {
  const cell = await screen.findByText(sku, {}, WAIT);
  const row = cell.closest("tr");
  if (!row) throw new Error(`no row for ${sku}`);
  return row;
};
const skusShown = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.querySelector("td span")?.textContent ?? "");

describe("bảng giá của khách", () => {
  it("14 chỉ dòng của khách đang chọn", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    await table();
    expect(skusShown()).toEqual(["SKU-001-BLK-L", "SKU-002-WHT", "SKU-003-WHT-L"]);
    // giá của khách B cho cùng SKU (99.000) không lẫn vào
    expect(screen.queryByText(/99\.000/)).toBeNull();
  });

  it("15 đổi khách: không bao giờ hiện dòng của khách cũ dưới khách mới", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    stubPermissions(ALL, (url, params) =>
      url === "/catalog/customer-prices" && params.get("customerId") === B
        ? gate.then(() => passThrough(url, { params }))
        : undefined,
    );
    const view = render(`customerId=${A}`);
    await rowOf("SKU-002-WHT");
    view.navigate(`customerId=${B}`);
    expect(await screen.findByText(T.loading, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText("SKU-002-WHT")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    release();
    await waitFor(() => expect(skusShown()).toEqual(["SKU-001-BLK-L"]), WAIT);
  });

  it("16 phân trang phía FE: 12 dòng → trang 1 có 10, trang 2 có 2", async () => {
    seedTwelve(C, "PG");
    stubPermissions(ALL);
    render(`customerId=${C}`);
    await table();
    expect(skusShown()).toHaveLength(10);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sau" }));
    expect(skusShown()).toEqual(["PG-11", "PG-12"]);
  });

  it("17 lọc SKU phía FE; lọc không ra dòng khác với khách chưa có giá", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    await table();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(T.filter), "002");
    expect(skusShown()).toEqual(["SKU-002-WHT"]);
    await user.clear(screen.getByPlaceholderText(T.filter));
    await user.type(screen.getByPlaceholderText(T.filter), "khong-co");
    expect(await screen.findByText(T.noMatch)).toBeInTheDocument();
    expect(screen.queryByText(T.noPrices)).toBeNull();
    await user.click(screen.getByRole("button", { name: T.clearFilter }));
    expect(skusShown()).toHaveLength(3);
  });

  it("18 đổi khách (kể cả khách đã có trong cache, bảng không qua trạng thái tải) → về trang 1", async () => {
    seedTwelve(C, "PG");
    seedTwelve(D, "QX");
    stubPermissions(ALL);
    const view = render(`customerId=${D}`);
    await waitFor(() => expect(skusShown()[0]).toBe("QX-01"), WAIT);
    view.navigate(`customerId=${C}`);
    await waitFor(() => expect(skusShown()[0]).toBe("PG-01"), WAIT);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sau" }));
    expect(skusShown()).toEqual(["PG-11", "PG-12"]);
    // D đã trong cache → không có trạng thái tải ở giữa; trang 2 của C không được mang sang D
    view.navigate(`customerId=${D}`);
    await waitFor(() => expect(skusShown()[0]).toBe("QX-01"), WAIT);
    expect(skusShown()).toHaveLength(10);
  });

  it("19 + 20 + 21 MOQ nhiều bậc; giá tăng theo số lượng; thấp / cao nhất qua mọi bậc", async () => {
    seedMockCustomerPrice({
      customerId: C,
      sku: "MIXED-01",
      tiers: tiers([1, "100000"], [10, "80000"], [50, "120000"]),
      note: null,
      version: 0,
    });
    stubPermissions(ALL);
    const view = render(`customerId=${A}`);
    const blk = await rowOf("SKU-001-BLK-L");
    expect(blk).toHaveTextContent("10"); // MOQ = bậc đầu (10)
    expect(within(blk).getByText(/90\.000/)).toBeInTheDocument();
    expect(within(blk).getByText(/95\.000/)).toBeInTheDocument();
    const rising = await rowOf("SKU-003-WHT-L");
    const cells = within(rising)
      .getAllByRole("cell")
      .map((c) => c.textContent ?? "");
    expect(cells[3]).toMatch(/50\.000/); // thấp nhất = bậc đầu
    expect(cells[4]).toMatch(/52\.000/); // cao nhất = bậc sau (giá TĂNG)
    view.navigate(`customerId=${C}`);
    const mixed = await rowOf("MIXED-01");
    const mixedCells = within(mixed)
      .getAllByRole("cell")
      .map((c) => c.textContent ?? "");
    expect(mixedCells[3]).toMatch(/80\.000/); // bậc giữa, không phải đầu / cuối
    expect(mixedCells[4]).toMatch(/120\.000/);
  });

  it("22 giá không chính xác (vượt số an toàn) → cảnh báo, không trình bày như số chắc chắn", async () => {
    seedMockCustomerPrice({
      customerId: C,
      sku: "BIG-01",
      tiers: tiers([1, "9999999999999999"]),
      note: null,
      version: 0,
    });
    stubPermissions(ALL);
    render(`customerId=${C}`);
    const row = await rowOf("BIG-01");
    expect(within(row).getAllByText(T.inexactCell)).toHaveLength(2);
    await userEvent.setup().click(row);
    expect(await screen.findByRole("note")).toHaveTextContent(L.priceInexact);
  });
});

describe("chi tiết bậc giá", () => {
  it("23 + 24 bấm dòng → đúng SKU, bậc tăng dần theo số lượng, mỗi bậc 'Từ N đơn vị'", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    await userEvent.setup().click(await rowOf("SKU-001-BLK-L"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("SKU-001-BLK-L")).toBeInTheDocument();
    const steps = within(within(dialog).getByRole("region", { name: L.detail.tierHeading }))
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatch(/^Từ 10 đơn vị.*95\.000/);
    expect(steps[1]).toMatch(/^Từ 100 đơn vị.*90\.000/);
    expect(within(dialog).getByText("Giá đại lý cấp 1")).toBeInTheDocument();
  });

  it("25 không có ghi chú → 'Không có ghi chú'", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    await userEvent.setup().click(await rowOf("SKU-002-WHT"));
    expect(
      await within(await screen.findByRole("dialog")).findByText(L.detail.noNote),
    ).toBeInTheDocument();
  });

  it("26 không có nút tạo / sửa / xoá ở trang lẫn bảng chi tiết", async () => {
    stubPermissions(ALL);
    render(`customerId=${A}`);
    await userEvent.setup().click(await rowOf("SKU-001-BLK-L"));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /thêm|tạo|sửa|xoá|xóa/i })).toBeNull();
  });
});
