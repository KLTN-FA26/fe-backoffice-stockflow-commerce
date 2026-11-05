/**
 * Tạo bảng giá + quyền + vòng đời form, qua mock adapter thật (route Step 4B). Chỉ quyền được trả tay.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_FIELD_MESSAGES as M,
  CUSTOMER_PRICE_ERROR_MESSAGES as E,
  CUSTOMER_PRICE_PERMISSIONS as P,
  CUSTOMER_PRICE_UI_LABELS,
  INVENTORY_ITEM_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { CustomerPriceList } from "./CustomerPriceList";

const L = CUSTOMER_PRICE_UI_LABELS;
const F = L.form;
const BASE = [P.viewPage, P.read];
const CREATOR = [...BASE, P.create];

vi.setConfig({ testTimeout: 30_000 });
const WAIT = { timeout: 5_000 };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
  resetVariantMockStore();
});
afterEach(() => vi.restoreAllMocks());

const render = (search: string) => renderCustomerPrices(<CustomerPriceList />, search);
const qty = (row: number) => screen.getByLabelText(`${F.tierLabel(row)} — ${L.field.minQuantity}`);
const price = (row: number) => screen.getByLabelText(`${F.tierLabel(row)} — ${L.field.unitPrice}`);
const save = () => screen.getByRole("button", { name: F.save });
type User = ReturnType<typeof userEvent.setup>;

async function openCreate(user: User) {
  await user.click(await screen.findByRole("button", { name: F.create }, WAIT));
  return screen.findByRole("dialog");
}
async function fillTiers(user: User, tiers: [string, string][]) {
  for (let i = 0; i < tiers.length; i += 1) {
    if (i > 0) await user.click(screen.getByRole("button", { name: F.addTier }));
    const [q, p] = tiers[i] ?? ["", ""];
    await user.type(qty(i + 1), q);
    await user.type(price(i + 1), p);
  }
}
const posts = (post: { mock: { calls: unknown[][] } }) =>
  post.mock.calls.filter(([url]) => String(url).startsWith("/catalog/customer-prices/"));

describe("quyền", () => {
  it("1 thiếu CREATE → không có nút Thêm bảng giá", async () => {
    stubPermissions([...BASE, P.update, CUSTOMER_PERMISSIONS.read]);
    render(`customerId=${A}`);
    await screen.findByText("SKU-001-BLK-L", {}, WAIT);
    expect(screen.queryByRole("button", { name: F.create })).toBeNull();
  });

  it("2 thiếu UPDATE → không có nút Sửa bảng giá trên dòng", async () => {
    stubPermissions(CREATOR);
    render(`customerId=${A}`);
    await screen.findByText("SKU-001-BLK-L", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Sửa bảng giá/ })).toBeNull();
  });

  it("3 + 4 + 5 + 6 tạo được khi thiếu quyền tra khách; SKU nhập tay; không gọi /inventory khi thiếu quyền", async () => {
    const get = stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "sku-001-wht-l");
    await fillTiers(user, [["1", "20000"]]);
    await user.click(save());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(posts(post)[0]?.[0]).toBe(`/catalog/customer-prices/${C}/SKU-001-WHT-L`);
    expect(await screen.findByText("SKU-001-WHT-L", {}, WAIT)).toBeInTheDocument();
    const urls = get.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.startsWith("/inventory/items"))).toBe(false);
    expect(urls.some((u) => u.startsWith("/customers"))).toBe(false);
  });

  it("4 có quyền đọc hồ sơ hàng tồn → gợi ý SKU gọi /inventory/items?q=", async () => {
    const get = stubPermissions([...CREATOR, INVENTORY_ITEM_PERMISSIONS.read]);
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-00");
    await waitFor(
      () => expect(get.mock.calls.some(([u]) => u === "/inventory/items")).toBe(true),
      WAIT,
    );
  });
});

describe("tạo", () => {
  it("7 + 8 + 9 + 16 nhiều bậc, bậc đầu > 1, giá tăng; POST đúng thứ tự đã nhập, không có version / moq", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [
      ["50", "21000"],
      ["5", "20000"],
    ]);
    await user.click(save());
    await waitFor(() => expect(posts(post)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(posts(post)[0]?.[1]).toEqual({
      tiers: [
        { minQuantity: 50, unitPrice: 21000 },
        { minQuantity: 5, unitPrice: 20000 },
      ],
      note: null,
    });
    const row = (await screen.findByText("SKU-001-WHT-L", {}, WAIT)).closest("tr");
    const cells = within(row ?? document.body)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells.slice(1, 3)).toEqual(["5", "2"]); // MOQ = số lượng nhỏ nhất, 2 bậc
  });

  it("10 trùng số lượng → lỗi ở các dòng trùng, không lưu được", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [
      ["10", "100"],
      ["10", "90"],
    ]);
    expect(await screen.findAllByText(M.minQuantityDuplicate)).toHaveLength(2);
    expect(save()).toBeDisabled();
    expect(posts(post)).toHaveLength(0);
  });

  it("11 + 12 tối đa 20 bậc; không xoá được bậc cuối cùng", async () => {
    stubPermissions(CREATOR);
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    expect(screen.getByRole("button", { name: F.removeTier(1) })).toBeDisabled();
    for (let i = 1; i < 20; i += 1)
      await user.click(screen.getByRole("button", { name: F.addTier }));
    expect(screen.getByRole("button", { name: F.addTier })).toBeDisabled();
    expect(screen.getByText(F.tierLimit)).toBeInTheDocument();
  });

  it.each([
    ["0", M.unitPrice],
    ["95.000", F.digitsOnly],
    ["12,5", F.digitsOnly],
    ["12345678901234567", M.unitPrice],
    ["9999999999999999", M.unitPricePrecision],
  ])("13 + 14 đơn giá %s bị chặn trước khi gửi", async (value, message) => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [["1", value]]);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(posts(post)).toHaveLength(0);
  });

  it("15 ghi chú chỉ khoảng trắng → null", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [["1", "1000"]]);
    await user.type(screen.getByLabelText(L.field.note), "   ");
    await user.click(save());
    await waitFor(() => expect(posts(post)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect((posts(post)[0]?.[1] as { note: unknown }).note).toBeNull();
  });

  it("17 SKU đã có giá → báo CONFLICT, KHÔNG tự PUT, giữ bản nháp", async () => {
    stubPermissions([...CREATOR, P.update]);
    const put = vi.spyOn(api, "put");
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-BLK-L");
    await fillTiers(user, [["1", "1000"]]);
    await user.click(save());
    expect(await screen.findByText(E.CONFLICT, {}, WAIT)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    expect(price(1)).toHaveValue("1000");
  });

  it("SKU không có trong danh mục → VARIANT_NOT_FOUND ngay dưới ô SKU, giữ bản nháp", async () => {
    stubPermissions(CREATOR);
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "NO-SUCH-SKU");
    await fillTiers(user, [["1", "1000"]]);
    await user.click(save());
    expect(await screen.findByText(E.VARIANT_NOT_FOUND, {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("vòng đời form", () => {
  it("33 Huỷ khi chưa sửa → đóng, không gửi gì", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts(post)).toHaveLength(0);
  });

  it("34 bấm Lưu hai lần → một POST", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [["1", "1000"]]);
    await user.click(save());
    await user.click(screen.getByRole("button", { name: F.saving }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(posts(post)).toHaveLength(1);
  });

  it("37 đóng khi có thay đổi → hỏi; Tiếp tục sửa giữ bản nháp; Bỏ bản nháp đóng, không gửi", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001");
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(await screen.findByText(F.discardTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.keepEditing }));
    await waitFor(() => expect(screen.queryByText(F.discardTitle)).toBeNull());
    expect(screen.getByLabelText(F.sku)).toHaveValue("SKU-001");
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await screen.findByText(F.discardTitle);
    await user.click(screen.getByRole("button", { name: F.discard }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts(post)).toHaveLength(0);
  });

  it("35 khách trên URL đổi khi form đang sửa → khoá lưu, không ghi sang khách khác; quay lại thì lưu đúng khách", async () => {
    stubPermissions(CREATOR);
    const post = vi.spyOn(api, "post");
    const view = render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await fillTiers(user, [["1", "1000"]]);
    view.navigate(`customerId=${A}`);
    expect(await screen.findByText(F.customerChanged(C), {}, WAIT)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: F.returnToCustomer }));
    await waitFor(() => expect(view.urlUpdates.at(-1)).toBe(`?customerId=${C}`));
    await waitFor(() => expect(save()).toBeEnabled(), WAIT);
    await user.click(save());
    await waitFor(() => expect(posts(post)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(posts(post)[0]?.[0]).toBe(`/catalog/customer-prices/${C}/SKU-001-WHT-L`);
  });

  it("35 khách đổi khi form chưa sửa gì → đóng form", async () => {
    stubPermissions(CREATOR);
    const view = render(`customerId=${C}`);
    await openCreate(userEvent.setup());
    view.navigate(`customerId=${A}`);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });
});

describe("5B.4 mở bảng giá hiện có sau 409 CONFLICT", () => {
  const EDITOR = [...CREATOR, P.update];
  const SKU = "SKU-001-BLK-L";
  const OTHER_SKU = "SKU-001-WHT-L";
  const DETAIL = (sku: string) => `/catalog/customer-prices/${A}/${sku}`;
  const openExisting = (sku = SKU) =>
    screen.getByRole("button", { name: F.conflictOpenExisting(sku) });
  const anyOpenExisting = () => screen.queryByRole("button", { name: /Mở bảng giá hiện có/ });

  /** Tạo SKU đã có giá của khách A (bậc 1 × 1000 + ghi chú) → 409 CONFLICT. */
  async function conflict(user: User) {
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), SKU.toLowerCase());
    await fillTiers(user, [["1", "1000"]]);
    await user.type(screen.getByLabelText(L.field.note), "nháp");
    await user.click(save());
    expect(await screen.findByText(E.CONFLICT, {}, WAIT)).toBeInTheDocument();
  }

  it("A + B + C bấm mở → hỏi trước, chưa đổi chế độ; Tiếp tục sửa giữ nguyên bản nháp + lỗi + chế độ tạo", async () => {
    stubPermissions(EDITOR);
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await conflict(user);
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
    await user.click(openExisting());
    expect(await screen.findByText(F.openExistingTitle(SKU))).toBeInTheDocument();
    expect(screen.getByText(F.openExistingDescription(SKU))).toBeInTheDocument();
    // chưa chuyển sang sửa: vẫn là form tạo với đúng bản nháp
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
    expect(screen.queryByText(F.editTitle(SKU))).toBeNull();
    await user.click(screen.getByRole("button", { name: F.keepEditing }));
    await waitFor(() => expect(screen.queryByText(F.openExistingTitle(SKU))).toBeNull());
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(F.sku)).toHaveValue(SKU.toLowerCase());
    expect(qty(1)).toHaveValue("1");
    expect(price(1)).toHaveValue("1000");
    expect(screen.getByLabelText(L.field.note)).toHaveValue("nháp");
    expect(screen.getByText(E.CONFLICT)).toBeInTheDocument();
    expect(openExisting()).toBeInTheDocument();
  });

  it("D + H xác nhận → mở đúng bản ghi bằng GET chi tiết, lưu PUT với version của GET (không dùng bản nháp POST)", async () => {
    const get = stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await conflict(user);
    await user.click(openExisting());
    await user.click(await screen.findByRole("button", { name: F.openExistingConfirm }));
    expect(await screen.findByText(F.editTitle(SKU), {}, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(get.mock.calls.some(([url]) => url === DETAIL(SKU))).toBe(true));
    // dữ liệu của bản đã có, không phải bậc 1 × 1000 của bản nháp
    await waitFor(() => expect(price(1)).not.toHaveValue("1000"), WAIT);
    expect(screen.getByLabelText(L.field.note)).not.toHaveValue("nháp");
    await user.clear(price(1));
    await user.type(price(1), "88000");
    await user.click(save());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1), WAIT);
    expect(put.mock.calls[0]?.[0]).toBe(DETAIL(SKU));
    expect((put.mock.calls[0]?.[1] as { version: number }).version).toBe(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });

  it("E đổi ô SKU sau 409 → nút vẫn ghi rõ SKU đã gửi và mở đúng SKU đó, không bao giờ mở SKU đang gõ", async () => {
    const get = stubPermissions(EDITOR);
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await conflict(user);
    await user.clear(screen.getByLabelText(F.sku));
    await user.type(screen.getByLabelText(F.sku), OTHER_SKU);
    expect(screen.queryByRole("button", { name: F.conflictOpenExisting(OTHER_SKU) })).toBeNull();
    await user.click(openExisting(SKU));
    await user.click(await screen.findByRole("button", { name: F.openExistingConfirm }));
    expect(await screen.findByText(F.editTitle(SKU), {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(F.editTitle(OTHER_SKU))).toBeNull();
    expect(get.mock.calls.some(([url]) => url === DETAIL(OTHER_SKU))).toBe(false);
  });

  it.each([
    ["F CREATE thiếu READ", [P.viewPage, P.create, P.update]],
    ["G CREATE + READ thiếu UPDATE", CREATOR],
  ])("%s → không có lối mở bản có sẵn, báo lý do, giữ bản nháp", async (_label, permissions) => {
    stubPermissions(permissions);
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await conflict(user);
    expect(screen.getByText(F.conflictNoAccess)).toBeInTheDocument();
    expect(anyOpenExisting()).toBeNull();
    expect(price(1)).toHaveValue("1000");
    expect(screen.getByLabelText(L.field.note)).toHaveValue("nháp");
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
  });

  it.each([
    ["409 không phải CONFLICT", () => new ApiError(409, "OPTIMISTIC_LOCK", "stale")],
    ["409 mã lạ", () => new ApiError(409, "SOMETHING_ELSE", "x")],
    ["400 dữ liệu sai", () => new ApiError(400, "VALIDATION_FAILED", "bad")],
  ])("I %s khi tạo → không có nút mở bản có sẵn", async (_label, failure) => {
    stubPermissions(EDITOR);
    vi.spyOn(api, "post").mockRejectedValueOnce(failure());
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openCreate(user);
    await user.type(screen.getByLabelText(F.sku), OTHER_SKU);
    await fillTiers(user, [["1", "1000"]]);
    await user.click(save());
    await waitFor(() => expect(screen.getByRole("button", { name: F.save })).toBeEnabled(), WAIT);
    expect(anyOpenExisting()).toBeNull();
    expect(screen.queryByText(F.conflictNoAccess)).toBeNull();
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
  });

  it("J khách trên URL đổi → khoá bản nháp giữ nguyên: không có nút mở, hộp hỏi đang mở cũng không mở bản ghi", async () => {
    stubPermissions(EDITOR);
    const view = render(`customerId=${A}`);
    const user = userEvent.setup();
    await conflict(user);
    await user.click(openExisting());
    await screen.findByText(F.openExistingTitle(SKU));
    view.navigate(`customerId=${C}`);
    await user.click(screen.getByRole("button", { name: F.openExistingConfirm }));
    expect(await screen.findByText(F.customerChanged(A), {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
    expect(screen.queryByText(F.editTitle(SKU))).toBeNull();
    expect(anyOpenExisting()).toBeNull();
    expect(price(1)).toHaveValue("1000");
  });
});
