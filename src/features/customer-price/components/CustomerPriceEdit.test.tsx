/**
 * Sửa bảng giá (PUT thay toàn bộ) + khoá lạc quan + luồng thật qua mock adapter (route Step 4B).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_PRICE_ERROR_MESSAGES as E,
  CUSTOMER_PRICE_PERMISSIONS as P,
  CUSTOMER_PRICE_UI_LABELS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  OTHER_PRICED_CUSTOMER as B,
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
  seedMockCustomerPrice,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { getCustomerPrice, listCustomerPrices, updateCustomerPrice } from "../api";
import { customerPriceKeys } from "../queries";
import { beCustomerPriceSchema } from "../schemas";
import { CustomerPriceList } from "./CustomerPriceList";

const L = CUSTOMER_PRICE_UI_LABELS;
const F = L.form;
const EDITOR = [P.viewPage, P.read, P.create, P.update];
const SKU = "SKU-001-BLK-L";
const DETAIL = `/catalog/customer-prices/${A}/${SKU}`;

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
const puts = (put: { mock: { calls: unknown[][] } }) =>
  put.mock.calls.filter(([url]) => String(url).startsWith("/catalog/customer-prices/"));

async function openEdit(user: User, sku = SKU) {
  await user.click(await screen.findByRole("button", { name: F.editRow(sku) }, WAIT));
  await screen.findByText(F.editTitle(sku), {}, WAIT);
  await waitFor(() => expect(qty(1)).toBeInTheDocument(), WAIT);
}
async function retype(user: User, el: HTMLElement, value: string) {
  await user.clear(el);
  if (value !== "") await user.type(el, value);
}

describe("sửa", () => {
  it("19 + 20 + 21 nạp đúng bậc + ghi chú từ chi tiết; SKU / khách không sửa được", async () => {
    const get = stubPermissions(EDITOR);
    render(`customerId=${A}`);
    await openEdit(userEvent.setup());
    expect(
      [qty(1), price(1), qty(2), price(2)].map((el) => (el as HTMLInputElement).value),
    ).toEqual(["10", "95000", "100", "90000"]);
    expect(screen.getByLabelText(L.field.note)).toHaveValue("Giá đại lý cấp 1");
    expect(screen.queryByLabelText(F.sku)).toBeNull();
    expect(screen.getByText(F.skuLocked)).toBeInTheDocument();
    // bản chi tiết được tải riêng (không tin bản trong danh sách)
    expect(get.mock.calls.some(([u]) => u === DETAIL)).toBe(true);
  });

  it("22 + 24 + 25 sửa một bậc → PUT đủ mọi bậc + ghi chú cũ + version đã chụp; bảng hiện dữ liệu mới", async () => {
    stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await retype(user, price(2), "85000");
    await user.click(save());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(puts(put)[0]?.[1]).toEqual({
      tiers: [
        { minQuantity: 10, unitPrice: 95000 },
        { minQuantity: 100, unitPrice: 85000 },
      ],
      note: "Giá đại lý cấp 1",
      version: 2,
    });
    const row = (await screen.findByText(SKU)).closest("tr");
    await waitFor(() => expect(row).toHaveTextContent(/85\.000/), WAIT);
  });

  it("23 xoá ghi chú → PUT note null", async () => {
    stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await user.clear(screen.getByLabelText(L.field.note));
    await user.click(save());
    await waitFor(() => expect(puts(put)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect((puts(put)[0]?.[1] as { note: unknown }).note).toBeNull();
  });

  it("26 + 27 + 28 + 40 người khác vừa lưu → 409, giữ bản nháp, không tự gửi lại; bấm tải lại mới lấy version mới", async () => {
    stubPermissions(EDITOR);
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await retype(user, qty(1), "12");
    // một người khác lưu trước (qua route mock thật)
    await updateCustomerPrice({
      customerId: A,
      sku: SKU,
      version: 2,
      values: { tiers: [{ minQuantity: 20, unitPrice: "70000" }], note: null },
    });
    const put = vi.spyOn(api, "put");
    await user.click(save());
    expect(await screen.findByText(E.OPTIMISTIC_LOCK, {}, WAIT)).toBeInTheDocument();
    expect(qty(1)).toHaveValue("12");
    await new Promise((r) => setTimeout(r, 800));
    expect(puts(put)).toHaveLength(1);
    expect(screen.getByText(F.reloadWarning)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.reload }));
    await waitFor(() => expect(qty(1)).toHaveValue("20"), WAIT);
    await user.click(save());
    await waitFor(() => expect(puts(put)).toHaveLength(2), WAIT);
    expect((puts(put)[1]?.[1] as { version: number }).version).toBe(3);
  });

  it("29 bản mới hơn về cache khi đang sửa → giữ bản nháp + version cũ, chỉ báo", async () => {
    stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    const view = render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await retype(user, price(1), "93000");
    view.client.setQueryData(
      customerPriceKeys.detail(A, SKU),
      beCustomerPriceSchema.parse({
        customerId: A,
        sku: SKU,
        moq: 1,
        tiers: [{ minQuantity: 1, unitPrice: 1 }],
        version: 9,
      }),
    );
    expect(await screen.findByText(F.outdated)).toBeInTheDocument();
    expect(price(1)).toHaveValue("93000");
    await user.click(save());
    await waitFor(() => expect(puts(put)).toHaveLength(1), WAIT);
    expect((puts(put)[0]?.[1] as { version: number }).version).toBe(2);
    // version 2 vẫn là bản trên server → lưu thành công; chờ response để không rơi sang test sau
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });

  it("30 tải lại nền lỗi → giữ bản nháp, chỉ báo", async () => {
    let fail = false;
    stubPermissions(EDITOR, (url) =>
      url === DETAIL && fail ? Promise.reject(new ApiError(503, "UNAVAILABLE", "down")) : undefined,
    );
    const view = render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await retype(user, price(1), "91000");
    fail = true;
    await view.client.refetchQueries({ queryKey: customerPriceKeys.detail(A, SKU) });
    expect(await screen.findByText(F.refreshFailed, {}, WAIT)).toBeInTheDocument();
    expect(price(1)).toHaveValue("91000");
  });

  it.each([
    ["mạng", () => new Error("Network Error")],
    ["5xx", () => new ApiError(503, "UNAVAILABLE", "down")],
    ["403", () => new ApiError(403, "FORBIDDEN", "no")],
    ["404", () => new ApiError(404, "CUSTOMER_PRICE_NOT_FOUND", "gone")],
  ])(
    "5B.3 tải lại sau 409 lỗi %s khi cache còn bản cũ → giữ bản nháp + version + xung đột; thử lại thành công mới thay",
    async (_kind, failure) => {
      let fail = false;
      stubPermissions(EDITOR, (url) =>
        url === DETAIL && fail ? Promise.reject(failure()) : undefined,
      );
      const view = render(`customerId=${A}`);
      const user = userEvent.setup();
      await openEdit(user);
      await retype(user, qty(1), "12");
      // một người khác lưu trước (qua route mock thật): server lên version 3
      await updateCustomerPrice({
        customerId: A,
        sku: SKU,
        version: 2,
        values: { tiers: [{ minQuantity: 20, unitPrice: "70000" }], note: null },
      });
      fail = true; // từ đây GET chi tiết lỗi — kể cả lần tải lại nền sau 409
      const put = vi.spyOn(api, "put");
      await user.click(save());
      expect(await screen.findByText(E.OPTIMISTIC_LOCK, {}, WAIT)).toBeInTheDocument();

      // bấm tải lại: GET lỗi trong khi cache VẪN còn bản version 2 (đúng điều kiện của lỗi gốc)
      const key = customerPriceKeys.detail(A, SKU);
      const errorsBefore = view.client.getQueryState(key)?.errorUpdateCount ?? 0;
      await user.click(screen.getByRole("button", { name: F.reload }));
      await waitFor(() => {
        const state = view.client.getQueryState(key);
        expect(state?.errorUpdateCount).toBeGreaterThan(errorsBefore);
        expect(state?.fetchStatus).toBe("idle");
      }, WAIT);
      expect(view.client.getQueryState(key)?.status).toBe("error");
      expect(view.client.getQueryData<{ version: number }>(key)?.version).toBe(2);
      expect(qty(1)).toHaveValue("12");
      expect(await screen.findByText(F.reloadFailed, {}, WAIT)).toBeInTheDocument();
      expect(screen.getByText(E.OPTIMISTIC_LOCK)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: F.reload })).toBeEnabled();
      expect(puts(put)).toHaveLength(1);

      // version đã chụp không đổi: chỉ khi bấm Lưu mới gửi lại, vẫn version 2 (→ 409 lần nữa)
      await user.click(save());
      await waitFor(() => expect(puts(put)).toHaveLength(2), WAIT);
      expect((puts(put)[1]?.[1] as { version: number }).version).toBe(2);
      await screen.findByText(E.OPTIMISTIC_LOCK, {}, WAIT);

      // thử lại, GET thành công (version 3) → form + version mới, hết lỗi; Lưu gửi đủ bậc + ghi chú
      fail = false;
      await user.click(screen.getByRole("button", { name: F.reload }));
      await waitFor(() => expect(qty(1)).toHaveValue("20"), WAIT);
      expect(screen.queryByText(F.reloadFailed)).toBeNull();
      expect(screen.queryByText(E.OPTIMISTIC_LOCK)).toBeNull();
      await retype(user, price(1), "71000");
      await user.click(save());
      await waitFor(() => expect(puts(put)).toHaveLength(3), WAIT);
      expect(puts(put)[2]?.[1]).toEqual({
        version: 3,
        tiers: [{ minQuantity: 20, unitPrice: 71000 }],
        note: null,
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    },
  );

  it("31 bậc có giá không chính xác: ô để trống + cảnh báo, không lưu được tới khi nhập giá mới; bậc khác giữ nguyên", async () => {
    seedMockCustomerPrice({
      customerId: C,
      sku: "SKU-002-WHT",
      tiers: [
        { minQuantity: 1, unitPrice: "9999999999999999" },
        { minQuantity: 10, unitPrice: "5000" },
      ],
      note: null,
      version: 0,
    });
    stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await openEdit(user, "SKU-002-WHT");
    expect(screen.getByRole("note")).toHaveTextContent(F.inexactWarning);
    expect(price(1)).toHaveValue("");
    expect(price(2)).toHaveValue("5000");
    await waitFor(() => expect(save()).toBeDisabled());
    await user.type(price(1), "9000");
    await waitFor(() => expect(save()).toBeEnabled());
    await user.click(save());
    await waitFor(() => expect(puts(put)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect((puts(put)[0]?.[1] as { tiers: unknown }).tiers).toEqual([
      { minQuantity: 1, unitPrice: 9000 },
      { minQuantity: 10, unitPrice: 5000 },
    ]);
  });

  it("32 lỗi theo field của BE gắn đúng dòng đã gửi (tiers[1].unitPrice → bậc 2)", async () => {
    stubPermissions(EDITOR);
    vi.spyOn(api, "put").mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_FAILED", "invalid", {
        "tiers[1].unitPrice": "must not be null",
      }),
    );
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await retype(user, price(2), "88000");
    await user.click(save());
    const row2 = await screen.findByRole("listitem", { name: F.tierLabel(2) }, WAIT);
    expect(await within(row2).findByText("must not be null")).toBeInTheDocument();
    const row1 = screen.getByRole("listitem", { name: F.tierLabel(1) });
    expect(within(row1).queryByText("must not be null")).toBeNull();
  });

  it("36 đổi bản ghi → lưu đúng SKU mới, không dính SKU trước", async () => {
    stubPermissions(EDITOR);
    const put = vi.spyOn(api, "put");
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user, SKU);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await openEdit(user, "SKU-002-WHT");
    await retype(user, price(1), "140000");
    await user.click(save());
    await waitFor(() => expect(puts(put)).toHaveLength(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    expect(puts(put)[0]?.[0]).toBe(`/catalog/customer-prices/${A}/SKU-002-WHT`);
  });
});

describe("luồng thật qua mock", () => {
  it("38 + 42 tạo → GET danh sách có bản ghi; giá an toàn giữ đúng chữ số", async () => {
    stubPermissions(EDITOR);
    render(`customerId=${C}`);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: F.create }, WAIT));
    await user.type(screen.getByLabelText(F.sku), "SKU-001-WHT-L");
    await user.type(qty(1), "3");
    await user.type(price(1), "123456789012345");
    await user.click(save());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    const [created] = await listCustomerPrices(C);
    expect(created).toMatchObject({ sku: "SKU-001-WHT-L", moq: 3, version: 0 });
    expect(created?.tiers[0]).toEqual({
      minQuantity: 3,
      unitPrice: "123456789012345",
      unitPriceExact: true,
    });
  });

  it("39 + 41 sửa → GET trả bậc mới + version + 1; khách khác cùng SKU không đổi", async () => {
    stubPermissions(EDITOR);
    render(`customerId=${A}`);
    const user = userEvent.setup();
    await openEdit(user);
    await user.click(screen.getByRole("button", { name: F.removeTier(2) }));
    await retype(user, price(1), "97000");
    await user.click(save());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    const saved = await getCustomerPrice(A, SKU);
    expect(saved).toMatchObject({ version: 3, moq: 10, note: "Giá đại lý cấp 1" });
    expect(saved.tiers.map((t) => [t.minQuantity, t.unitPrice])).toEqual([[10, "97000"]]);
    expect(await getCustomerPrice(B, SKU)).toMatchObject({ version: 0 });
  });
});
