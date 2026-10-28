import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PRODUCT_PERMISSIONS,
  SKU_PURCHASING_FIELD_MESSAGES,
  SUPPLIER_ITEM_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, pickOption, renderApp } from "../../product-test-utils";
import { skuPurchasingKeys } from "../../purchasing-queries";
import { beSkuPurchasingSchema } from "../../purchasing-schemas";
import { beVariantSchema } from "../../variant-schemas";
import { VariantPanel } from "./VariantPanel";

import type { Variant } from "../../variant-schemas";

const L = UI_LABELS.skuPurchasing;
const M = UI_LABELS.skuPurchasing.saveError;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SUP = "33333333-3333-4333-8333-333333333333";
const OTHER = "55555555-5555-4555-8555-555555555555";
const GONE = "66666666-6666-4666-8666-666666666666";

const variantOf = (variantId: string, sku: string, status = "ACTIVE"): Variant =>
  beVariantSchema.parse({
    variantId,
    productId: PRODUCT,
    sku,
    name: sku,
    status,
    defaultVariant: false,
    position: 0,
    version: 0,
    options: [],
    inventoryItemId: null,
  });
const A = variantOf("v-a", "CUP-A");
const B = variantOf("v-b", "CUP-B");
const path = (v: Variant) => `/products/${PRODUCT}/variants/${v.variantId}/purchasing`;
const suppliersPath = (v: Variant) => `/procurement/skus/${v.sku}/suppliers`;

/** Ví dụ của chủ dự án: NCC mặc định, giá 10000 VND, 5 ngày, MOQ 10, version 7. */
const server = (v: Variant, over: Record<string, unknown> = {}) => ({
  variantId: v.variantId,
  sku: v.sku,
  version: 7,
  defaultSupplierId: SUP,
  referencePurchasePrice: 10000,
  referencePurchaseCurrency: "VND",
  leadTimeDays: 5,
  moq: 10,
  ...over,
});
const row = (supplierId: string, code: string, over: Record<string, unknown> = {}) => ({
  supplierId,
  supplierCode: code,
  supplierName: `NCC ${code}`,
  supplierStatus: "ACTIVE",
  supplierItemId: `si-${code}`,
  supplierSkuCode: null,
  price: 9000,
  currency: "VND",
  moq: 12,
  packSize: 6,
  effectiveLeadTimeDays: 4,
  preferred: supplierId === SUP,
  ...over,
});
const catalog = () => [
  row(OTHER, "SUP-B"),
  row(SUP, "SUP-A"),
  row(GONE, "SUP-X", { supplierStatus: "INACTIVE" }),
];

const EDIT = [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update];
const FULL = [...EDIT, SUPPLIER_ITEM_PERMISSIONS.read];

afterEach(() => vi.restoreAllMocks());

function setup(
  permissions: readonly string[],
  options: {
    get?: Record<string, () => unknown>;
    put?: (url: string, body: unknown) => unknown;
    panel?: Partial<Parameters<typeof VariantPanel>[0]>;
  } = {},
) {
  const calls = installApi({
    permissions,
    get: (url) => {
      if (url.endsWith("/base-price")) return { sku: "x", revision: 0 };
      if (url.endsWith("/media")) return [];
      return (options.get ?? { [path(A)]: () => server(A), [suppliersPath(A)]: catalog })[url]?.();
    },
    put: (url, body) => options.put?.(url, body) ?? server(A, { version: 8 }),
  });
  const view = renderApp(
    <VariantPanel
      productId={PRODUCT}
      variant={A}
      productApproved
      acceptsChanges
      productDiscontinued={false}
      open
      onClose={() => {}}
      {...options.panel}
    />,
  );
  return { ...calls, ...view, user: userEvent.setup() };
}

const editButton = () => screen.findByRole("button", { name: L.edit });
const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const lastBody = (put: { mock: { calls: unknown[][] } }) => put.mock.calls.at(-1)?.[1];

async function edit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await editButton());
  return screen.getByRole("form", { name: L.title });
}
async function retype(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.clear(input(label));
  if (value !== "") await user.type(input(label), value);
}
const saveButton = () => screen.getByRole("button", { name: L.save });

describe("Sửa thông tin mua hàng — quyền và trạng thái", () => {
  it("A1 thiếu product-products:UPDATE → không có nút Sửa", async () => {
    setup([PRODUCT_PERMISSIONS.read, SUPPLIER_ITEM_PERMISSIONS.read]);
    expect(await screen.findByRole("region", { name: L.referenceTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.edit })).toBeNull();
  });

  it("A2 UPDATE + đọc danh mục NCC → form đủ, chọn được NCC", async () => {
    const { user } = setup(FULL);
    await edit(user);
    expect(
      await screen.findByRole("combobox", { name: L.field.defaultSupplier }),
    ).toBeInTheDocument();
  });

  it("A3 + C18 UPDATE không có quyền đọc NCC → sửa giá trị tham chiếu, NCC mặc định giữ nguyên", async () => {
    const { user, put, get } = setup(EDIT);
    await edit(user);
    expect(get.mock.calls.some(([url]) => url === suppliersPath(A))).toBe(false);
    expect(screen.queryByRole("combobox", { name: L.field.defaultSupplier })).toBeNull();
    expect(screen.getByText(L.form.supplierLocked)).toBeInTheDocument();
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: SUP });
  });

  it("A4 sản phẩm không nhận thay đổi → không có nút Sửa (vẫn đọc được)", async () => {
    setup(FULL, { panel: { acceptsChanges: false } });
    expect(await screen.findByRole("region", { name: L.referenceTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.edit })).toBeNull();
  });

  it("A5 biến thể OBSOLETE → không có nút Sửa", async () => {
    const obsolete = variantOf("v-a", "CUP-A", "OBSOLETE");
    setup(FULL, { panel: { variant: obsolete } });
    expect(await screen.findByRole("region", { name: L.referenceTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.edit })).toBeNull();
  });
});

describe("Sửa thông tin mua hàng — form", () => {
  it("B6 ô nhập điền đúng giá trị hiện có", async () => {
    const { user } = setup(FULL);
    await edit(user);
    expect(input(L.field.referencePrice).value).toBe("10000");
    expect(input(L.field.currency).value).toBe("VND");
    expect(input(L.field.leadTimeDays).value).toBe("5");
    expect(input(L.field.moq).value).toBe("10");
  });

  it("B7 + D19 chỉ sửa MOQ → PUT thay toàn bộ giữ mọi field khác, gửi version đã chụp", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(path(A), {
      version: 7,
      defaultSupplierId: SUP,
      referencePurchasePrice: 10000,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 5,
      moq: 20,
    });
  });

  it("B8 + B9 xoá ô → null tường minh; 0 giữ là 0", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.referencePrice, "");
    await retype(user, L.field.currency, "");
    await retype(user, L.field.leadTimeDays, "0");
    await retype(user, L.field.moq, "");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toEqual({
      version: 7,
      defaultSupplierId: SUP,
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      leadTimeDays: 0,
      moq: null,
    });
  });

  it("B10 giá thiếu tiền tệ / tiền tệ thiếu giá → lỗi ở ô thiếu, không lưu được", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.currency, "");
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(screen.getByText(/phải nhập cùng nhau/)).toBeInTheDocument();
    await retype(user, L.field.referencePrice, "");
    await retype(user, L.field.currency, "USD");
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ["1.0055", /chữ số thập phân/],
    ["0", /lớn hơn 0/],
    ["12a", /lớn hơn 0/],
    ["9999999999999999.99", /quá nhiều chữ số để gửi chính xác/],
  ])("B11 giá %s bị chặn trước khi gửi", async (price, message) => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.referencePrice, price);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("giữ đúng chữ số người nhập (dấu chấm thập phân, không làm tròn)", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.referencePrice, "12345678901234.56");
    await retype(user, L.field.currency, "usd");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(lastBody(put))).toContain(
      '"referencePurchasePrice":12345678901234.56,"referencePurchaseCurrency":"USD"',
    );
  });

  it("B12 Huỷ → không gửi gì, hiện lại giá trị server", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await retype(user, L.field.moq, "99");
    await user.click(screen.getByRole("button", { name: L.cancel }));
    const ref = await screen.findByRole("region", { name: L.referenceTitle });
    expect(within(ref).getByText(L.field.moq).nextElementSibling).toHaveTextContent("10");
    expect(put).not.toHaveBeenCalled();
  });

  it("B13 bấm Lưu hai lần khi đang lưu → chỉ một PUT", async () => {
    const { user, put } = setup(FULL);
    let finish: () => void = () => undefined;
    put.mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve({ data: server(A, { version: 8 }) }))),
    );
    await edit(user);
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    const pending = await screen.findByRole("button", { name: L.saving });
    expect(pending).toBeDisabled();
    expect(screen.getByRole("button", { name: L.cancel })).toBeDisabled();
    await user.click(pending);
    finish();
    await screen.findByRole("region", { name: L.referenceTitle });
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("Sửa thông tin mua hàng — tải lại sau 409 bị lỗi (5B.3)", () => {
  const FM = UI_LABELS.skuPurchasing.form;
  const KEY = skuPurchasingKeys.detail(PRODUCT, A.variantId);

  it.each([
    ["mạng", () => new Error("Network Error")],
    ["5xx", () => new ApiError(503, "SERVICE_UNAVAILABLE", "down")],
    ["403", () => new ApiError(403, "FORBIDDEN", "no")],
    ["404", () => new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "gone")],
  ])(
    "lỗi %s khi cache còn bản cũ → giữ bản nháp, version đã chụp, xung đột; thử lại thành công mới thay",
    async (_kind, failure) => {
      let mode: "fail" | "ok" | "first" = "first";
      let conflictPut = true;
      const { user, put, client } = setup(FULL, {
        get: {
          [path(A)]: () => {
            if (mode === "first") return server(A);
            if (mode === "fail") throw failure();
            return server(A, { version: 9, moq: 15 });
          },
          [suppliersPath(A)]: catalog,
        },
        put: () => {
          if (conflictPut) throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
          return server(A, { version: 10, moq: 21 });
        },
      });
      await edit(user);
      await retype(user, L.field.moq, "20");
      mode = "fail"; // từ đây mọi GET lỗi — kể cả lần tải lại nền sau 409
      await user.click(saveButton());
      expect(await screen.findByRole("alert")).toHaveTextContent(M.versionConflict);

      // 1–3: bấm tải lại, GET lỗi trong khi cache VẪN còn bản version 7 (đúng điều kiện của lỗi gốc)
      const errorsBefore = client.getQueryState(KEY)?.errorUpdateCount ?? 0;
      await user.click(screen.getByRole("button", { name: FM.reload }));
      await waitFor(() => {
        const state = client.getQueryState(KEY);
        expect(state?.errorUpdateCount).toBeGreaterThan(errorsBefore);
        expect(state?.fetchStatus).toBe("idle");
      });
      expect(client.getQueryState(KEY)?.status).toBe("error");
      expect(client.getQueryData<{ version: number }>(KEY)?.version).toBe(7);
      expect(input(L.field.moq).value).toBe("20");
      expect(await screen.findByText(FM.reloadFailed)).toBeInTheDocument();
      expect(screen.getByText(M.versionConflict)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: FM.reload })).toBeEnabled();
      expect(put).toHaveBeenCalledTimes(1);

      // version đã chụp không đổi: chỉ khi người dùng bấm Lưu mới gửi lại, vẫn version 7
      await user.click(saveButton());
      await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
      expect(lastBody(put)).toMatchObject({ version: 7, moq: 20 });

      // 6–7: thử lại, GET thành công với version 9 → form + version mới, hết lỗi; Lưu gửi đủ field
      mode = "ok";
      conflictPut = false;
      await user.click(screen.getByRole("button", { name: FM.reload }));
      await waitFor(() => expect(input(L.field.moq).value).toBe("15"));
      expect(screen.queryByText(FM.reloadFailed)).toBeNull();
      expect(screen.queryByText(M.versionConflict)).toBeNull();
      await retype(user, L.field.moq, "21");
      await user.click(saveButton());
      await waitFor(() => expect(put).toHaveBeenCalledTimes(3));
      expect(lastBody(put)).toEqual({
        version: 9,
        defaultSupplierId: SUP,
        referencePurchasePrice: 10000,
        referencePurchaseCurrency: "VND",
        leadTimeDays: 5,
        moq: 21,
      });
    },
  );

  it("đang tải lại → nút khoá + nhãn đang tải; xong (kể cả lỗi) thì mở lại, không kẹt", async () => {
    let release: () => void = () => undefined;
    const { user, get } = setup(FULL, {
      put: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
      },
    });
    await edit(user);
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    await screen.findByText(M.versionConflict);
    // GET kế tiếp của thông tin mua hàng treo tới khi `release()` rồi lỗi mạng
    const passThrough = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url === path(A)
        ? new Promise<never>((_, reject) => (release = () => reject(new Error("Network Error"))))
        : passThrough?.(url, config),
    );
    await user.click(screen.getByRole("button", { name: FM.reload }));
    expect(await screen.findByRole("button", { name: FM.reloading })).toBeDisabled();
    release();
    expect(await screen.findByText(FM.reloadFailed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: FM.reload })).toBeEnabled();
    expect(input(L.field.moq).value).toBe("20");
  });
});

describe("Sửa thông tin mua hàng — giá nhập mơ hồ (P2-5)", () => {
  const FM = UI_LABELS.skuPurchasing.form;
  const priceField = () => input(L.field.referencePrice).parentElement as HTMLElement;

  it.each([
    ["150.000", "150000"],
    ["150,000", "150000"],
  ])(
    "11 + 12 %s → lỗi ngay cạnh ô giá, giữ chữ đã nhập, Lưu bị khoá, Enter cũng không gửi PUT",
    async (price, digits) => {
      const { user, put } = setup(FULL);
      await edit(user);
      await retype(user, L.field.referencePrice, price);
      expect(
        await within(priceField()).findByText(
          SKU_PURCHASING_FIELD_MESSAGES.referencePurchasePriceGrouped(digits),
        ),
      ).toBeInTheDocument();
      expect(input(L.field.referencePrice).value).toBe(price);
      expect(saveButton()).toBeDisabled();
      await user.type(input(L.field.moq), "{Enter}");
      await user.click(saveButton());
      expect(put).not.toHaveBeenCalled();
    },
  );

  it("13 + 14 + 15 sửa lại thành 150000 → lưu được; PUT gửi 150000, giữ mọi field khác + version", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    expect(within(priceField()).getByText(FM.priceHint)).toBeInTheDocument();
    await retype(user, L.field.referencePrice, "150.000");
    await waitFor(() => expect(saveButton()).toBeDisabled());
    await retype(user, L.field.referencePrice, "150000");
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(within(priceField()).queryByText(/phân cách hàng nghìn\./)).toBeNull();
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(path(A), {
      version: 7,
      defaultSupplierId: SUP,
      referencePurchasePrice: 150000,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 5,
      moq: 10,
    });
  });

  it("16 sau khi sửa giá mơ hồ, 409 OPTIMISTIC_LOCK vẫn báo xung đột, giữ bản nháp, không tự gửi lại", async () => {
    const { user, put } = setup(FULL, {
      put: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
      },
    });
    await edit(user);
    await retype(user, L.field.referencePrice, "95,000");
    await waitFor(() => expect(saveButton()).toBeDisabled());
    await retype(user, L.field.referencePrice, "95000");
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.versionConflict);
    expect(put).toHaveBeenCalledTimes(1);
    expect(lastBody(put)).toMatchObject({ version: 7, referencePurchasePrice: 95000 });
    expect(input(L.field.referencePrice).value).toBe("95000");
  });
});

describe("Sửa thông tin mua hàng — chọn NCC", () => {
  it("C14 chọn NCC đang hoạt động → gửi supplierId của nó; NCC ngừng không chọn được", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await user.click(await screen.findByRole("combobox", { name: L.field.defaultSupplier }));
    expect(screen.getByRole("option", { name: /SUP-X/ })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("option", { name: L.supplier.name("SUP-B", "NCC SUP-B") }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: OTHER });
  });

  it("C15 xoá NCC mặc định → null", async () => {
    const { user, put } = setup(FULL);
    await edit(user);
    await pickOption(user, L.field.defaultSupplier, L.form.noSupplier);
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: null });
  });

  it("C16 NCC hiện có không còn trong danh mục → giữ nguyên, báo rõ, không chọn NCC khác", async () => {
    const { user, put } = setup(FULL, {
      get: { [path(A)]: () => server(A), [suppliersPath(A)]: () => [row(OTHER, "SUP-B")] },
    });
    await edit(user);
    const combo = await screen.findByRole("combobox", { name: L.field.defaultSupplier });
    expect(combo).toHaveTextContent(L.form.currentNotListed(SUP));
    await retype(user, L.field.moq, "11");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: SUP, moq: 11 });
  });

  it("C NCC hiện có đã ngừng → hiện trạng thái, vẫn sửa được ô khác mà giữ NCC", async () => {
    const { user, put } = setup(FULL, {
      get: {
        [path(A)]: () => server(A),
        [suppliersPath(A)]: () => [row(SUP, "SUP-A", { supplierStatus: "INACTIVE" })],
      },
    });
    await edit(user);
    const combo = await screen.findByRole("combobox", { name: L.field.defaultSupplier });
    expect(combo).toHaveTextContent(/không còn hoạt động \(giữ nguyên\)/);
    await retype(user, L.field.leadTimeDays, "9");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: SUP, leadTimeDays: 9 });
  });

  it("C17 tải danh mục NCC lỗi → ô NCC chỉ đọc, báo lỗi, lưu vẫn giữ NCC mặc định", async () => {
    const { user, put } = setup(FULL, {
      get: {
        [path(A)]: () => server(A),
        [suppliersPath(A)]: () => {
          throw new ApiError(500, "INTERNAL_ERROR", "boom");
        },
      },
    });
    await edit(user);
    expect(await screen.findByText(L.supplier.loadFailed)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: L.field.defaultSupplier })).toBeNull();
    await retype(user, L.field.moq, "30");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ defaultSupplierId: SUP, moq: 30 });
  });
});

describe("Sửa thông tin mua hàng — đồng thời", () => {
  it("D20 + D21 OPTIMISTIC_LOCK: báo xung đột, không tự gửi lại, giữ bản nháp; bấm tải lại mới lấy version mới", async () => {
    let version = 7;
    const { user, put } = setup(FULL, {
      get: {
        [path(A)]: () => server(A, { version, moq: version === 7 ? 10 : 15 }),
        [suppliersPath(A)]: catalog,
      },
      put: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
      },
    });
    await edit(user);
    await retype(user, L.field.moq, "20");
    version = 9; // có người vừa lưu ở nơi khác
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.versionConflict);
    expect(put).toHaveBeenCalledTimes(1);
    expect(input(L.field.moq).value).toBe("20");
    expect(screen.getByText(L.form.reloadWarning)).toBeInTheDocument();

    put.mockImplementation(async () => ({ data: server(A, { version: 10 }) }));
    await user.click(screen.getByRole("button", { name: L.form.reload }));
    await waitFor(() => expect(input(L.field.moq).value).toBe("15"));
    await retype(user, L.field.moq, "21");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(lastBody(put)).toMatchObject({ version: 9, moq: 21 });
  });

  it("D22 bản mới hơn về cache khi đang sửa → giữ bản nháp + version cũ, chỉ báo", async () => {
    const { user, put, client } = setup(FULL);
    await edit(user);
    await retype(user, L.field.moq, "44");
    client.setQueryData(
      skuPurchasingKeys.detail(PRODUCT, A.variantId),
      beSkuPurchasingSchema.parse(server(A, { version: 8, moq: 99 })),
    );
    expect(await screen.findByText(L.form.outdated)).toBeInTheDocument();
    expect(input(L.field.moq).value).toBe("44");
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(lastBody(put)).toMatchObject({ version: 7, moq: 44 });
  });

  it("D23 409 nghiệp vụ (sản phẩm chờ duyệt) khác xung đột version: không có nút tải lại", async () => {
    const { user } = setup(FULL, {
      put: () => {
        throw new ApiError(409, "CONFLICT", "locked");
      },
    });
    await edit(user);
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.productLocked);
    expect(screen.queryByRole("button", { name: L.form.reload })).toBeNull();
  });

  it("lỗi theo ô của BE gắn vào ô; NCC ngừng hoạt động gắn vào ô NCC", async () => {
    const { user } = setup(FULL, {
      put: () => {
        throw new ApiError(409, "SUPPLIER_INACTIVE", "inactive");
      },
    });
    await edit(user);
    await pickOption(user, L.field.defaultSupplier, L.supplier.name("SUP-B", "NCC SUP-B"));
    await user.click(saveButton());
    expect(await screen.findByText(M.SUPPLIER_INACTIVE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.form.reload })).toBeNull();
  });

  it("D24 đổi biến thể khi PUT của A đang chạy → form đóng, B không nhận dữ liệu / PUT của A", async () => {
    let finishA: () => void = () => undefined;
    const calls = installApi({
      permissions: FULL,
      get: (url) => {
        if (url.endsWith("/base-price")) return { sku: "x", revision: 0 };
        if (url.endsWith("/media")) return [];
        if (url === path(A)) return server(A);
        if (url === path(B)) return server(B, { moq: 77 });
        if (url === suppliersPath(A) || url === suppliersPath(B)) return catalog();
        return undefined;
      },
    });
    calls.put.mockImplementation(
      () =>
        new Promise(
          (resolve) => (finishA = () => resolve({ data: server(A, { version: 8, moq: 20 }) })),
        ),
    );
    function Switcher() {
      const [variant, setVariant] = useState(A);
      return (
        <>
          <button type="button" onClick={() => setVariant(B)}>
            next
          </button>
          <VariantPanel
            productId={PRODUCT}
            variant={variant}
            productApproved
            acceptsChanges
            productDiscontinued={false}
            open
            onClose={() => {}}
          />
        </>
      );
    }
    renderApp(<Switcher />);
    const user = userEvent.setup();
    await edit(user);
    await retype(user, L.field.moq, "20");
    await user.click(saveButton());
    // nút đổi biến thể của test nằm sau lớp phủ của sheet — chỉ bỏ kiểm pointer-events cho cú bấm này
    const outside = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    await outside.click(screen.getByRole("button", { name: "next", hidden: true }));
    finishA();
    const ref = await screen.findByRole("region", { name: L.referenceTitle });
    await waitFor(() =>
      expect(within(ref).getByText(L.field.moq).nextElementSibling).toHaveTextContent("77"),
    );
    expect(screen.queryByRole("form", { name: L.title })).toBeNull();
    expect(calls.put).toHaveBeenCalledTimes(1);
    expect(calls.put.mock.calls[0]?.[0]).toBe(path(A));
  });
});
