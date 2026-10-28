import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, SUPPLIER_ITEM_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../../product-test-utils";
import { beVariantSchema } from "../../variant-schemas";
import { VariantPanel } from "./VariantPanel";

import type { AxiosRequestConfig } from "axios";
import type { Variant } from "../../variant-schemas";

const L = UI_LABELS.skuPurchasing;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const OTHER_SUPPLIER = "55555555-5555-4555-8555-555555555555";

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

const purchasingPath = (v: Variant) => `/products/${PRODUCT}/variants/${v.variantId}/purchasing`;
const suppliersPath = (v: Variant) => `/procurement/skus/${v.sku}/suppliers`;

/** BE `SkuPurchasingResponse` — Jackson non_null bỏ field null. */
const configured = (v: Variant, over: Record<string, unknown> = {}) => ({
  variantId: v.variantId,
  sku: v.sku,
  version: 3,
  defaultSupplierId: SUPPLIER,
  referencePurchasePrice: 12500.5,
  referencePurchaseCurrency: "VND",
  leadTimeDays: 0,
  moq: 24,
  ...over,
});
const supplierRow = (supplierId: string, over: Record<string, unknown> = {}) => ({
  supplierId,
  supplierCode: supplierId === SUPPLIER ? "SUP-A" : "SUP-Z",
  supplierName: supplierId === SUPPLIER ? "Công ty A" : "Công ty Z",
  supplierStatus: "ACTIVE",
  supplierItemId: `si-${supplierId}`,
  supplierSkuCode: "A-CUP-01",
  price: 11000,
  currency: "VND",
  moq: 48,
  packSize: 12,
  effectiveLeadTimeDays: 5,
  preferred: supplierId === SUPPLIER,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

/** Panel đủ các mục khác; `routes` trả theo URL, chưa mock thì ném lỗi (lộ ra request thừa). */
function setup(
  permissions: readonly string[],
  routes: Record<string, () => unknown>,
  props: Partial<Parameters<typeof VariantPanel>[0]> = {},
) {
  const calls = installApi({
    permissions,
    get: (url) => {
      if (url.endsWith("/base-price")) return { sku: "x", revision: 0 };
      if (url.endsWith("/media")) return [];
      return routes[url]?.();
    },
  });
  renderApp(
    <VariantPanel
      productId={PRODUCT}
      variant={A}
      productApproved
      acceptsChanges
      productDiscontinued={false}
      open
      onClose={() => {}}
      {...props}
    />,
  );
  const requested = (url: string) => calls.get.mock.calls.some(([u]) => u === url);
  return { ...calls, requested };
}

const BOTH = [PRODUCT_PERMISSIONS.read, SUPPLIER_ITEM_PERMISSIONS.read];
const reference = () => screen.findByRole("region", { name: L.referenceTitle });
const valueOf = (region: HTMLElement, label: string) =>
  within(region).getByText(label).nextElementSibling?.textContent ?? "";

describe("VariantPurchasing — hiển thị", () => {
  it("bản đã khai báo: NCC mặc định, giá chính xác, 0 ngày, MOQ; điều khoản NCC tách riêng", async () => {
    setup(BOTH, {
      [purchasingPath(A)]: () => configured(A),
      [suppliersPath(A)]: () => [supplierRow(SUPPLIER)],
    });
    const ref = await reference();
    await waitFor(() =>
      expect(valueOf(ref, L.field.defaultSupplier)).toBe(L.supplier.name("SUP-A", "Công ty A")),
    );
    expect(valueOf(ref, L.field.referencePrice)).toMatch(/12\.500,5\s?₫/);
    expect(valueOf(ref, L.field.leadTimeDays)).toBe(L.days(0));
    expect(valueOf(ref, L.field.moq)).toBe("24");
    const terms = screen.getByRole("region", { name: L.supplierTermsTitle });
    expect(valueOf(terms, L.field.supplierMoq)).toBe("48");
    expect(valueOf(terms, L.field.packSize)).toBe("12");
    expect(valueOf(terms, L.field.effectiveLeadTime)).toBe(L.days(5));
    expect(valueOf(terms, L.field.supplierSkuCode)).toBe("A-CUP-01");
  });

  it("mọi field vắng (chưa khai báo) → 'Chưa thiết lập', không tra danh mục NCC", async () => {
    const { requested } = setup(BOTH, {
      [purchasingPath(A)]: () => ({ variantId: A.variantId, sku: A.sku, version: 0 }),
    });
    const ref = await reference();
    for (const label of [
      L.field.defaultSupplier,
      L.field.referencePrice,
      L.field.leadTimeDays,
      L.field.moq,
    ]) {
      expect(valueOf(ref, label)).toBe(L.notSet);
    }
    expect(requested(suppliersPath(A))).toBe(false);
    expect(screen.queryByRole("region", { name: L.supplierTermsTitle })).toBeNull();
  });

  it("0 là giá trị thật, khác thiếu", async () => {
    setup([PRODUCT_PERMISSIONS.read], {
      [purchasingPath(A)]: () => ({
        variantId: A.variantId,
        sku: A.sku,
        version: 1,
        leadTimeDays: 0,
      }),
    });
    const ref = await reference();
    expect(valueOf(ref, L.field.leadTimeDays)).toBe(L.days(0));
    expect(valueOf(ref, L.field.moq)).toBe(L.notSet);
  });
});

describe("VariantPurchasing — quyền", () => {
  it("thiếu product-products:READ → câu không có quyền, không gọi API thông tin mua hàng", async () => {
    const { requested } = setup([SUPPLIER_ITEM_PERMISSIONS.read], {});
    expect(await screen.findByText(L.noPermission)).toBeInTheDocument();
    expect(requested(purchasingPath(A))).toBe(false);
    expect(requested(suppliersPath(A))).toBe(false);
  });

  it("có product READ, thiếu supplier-item READ → tải thông tin mua hàng, không tra NCC, chỉ hiện id", async () => {
    const { requested } = setup([PRODUCT_PERMISSIONS.read], {
      [purchasingPath(A)]: () => configured(A),
    });
    const ref = await reference();
    expect(valueOf(ref, L.field.defaultSupplier)).toContain(SUPPLIER);
    expect(within(ref).getByText(L.supplier.noPermission)).toBeInTheDocument();
    expect(requested(suppliersPath(A))).toBe(false);
    expect(screen.queryByRole("region", { name: L.supplierTermsTitle })).toBeNull();
    // chỉ đọc: không có nút chọn / sửa trong mục
    expect(within(ref).queryByRole("button")).toBeNull();
  });

  it("khớp NCC mặc định theo defaultSupplierId, không lấy dòng đầu danh sách", async () => {
    setup(BOTH, {
      [purchasingPath(A)]: () => configured(A, { defaultSupplierId: SUPPLIER }),
      // dòng đầu là NCC khác (vd BE đổi thứ tự / dữ liệu cũ) — không được nhận nhầm
      [suppliersPath(A)]: () => [
        supplierRow(OTHER_SUPPLIER, { preferred: true }),
        supplierRow(SUPPLIER, { moq: 6, preferred: false }),
      ],
    });
    const ref = await reference();
    await waitFor(() =>
      expect(valueOf(ref, L.field.defaultSupplier)).toBe(L.supplier.name("SUP-A", "Công ty A")),
    );
    const terms = screen.getByRole("region", { name: L.supplierTermsTitle });
    expect(valueOf(terms, L.field.supplierMoq)).toBe("6");
  });

  it("NCC mặc định không có trong danh sách → vẫn hiện id (nguồn đúng), không nói 'chưa thiết lập'", async () => {
    setup(BOTH, {
      [purchasingPath(A)]: () => configured(A),
      [suppliersPath(A)]: () => [supplierRow(OTHER_SUPPLIER)],
    });
    const ref = await reference();
    expect(await within(ref).findByText(L.supplier.notListed)).toBeInTheDocument();
    expect(valueOf(ref, L.field.defaultSupplier)).toContain(SUPPLIER);
    expect(valueOf(ref, L.field.defaultSupplier)).not.toContain(L.notSet);
    expect(screen.queryByRole("region", { name: L.supplierTermsTitle })).toBeNull();
  });
});

describe("VariantPurchasing — tải / lỗi", () => {
  it("đang tải → câu đang tải; lỗi 500 → báo lỗi + Thử lại; thử lại thành công hiện dữ liệu", async () => {
    let fail = true;
    setup([PRODUCT_PERMISSIONS.read], {
      [purchasingPath(A)]: () => {
        if (fail) throw new ApiError(500, "INTERNAL_ERROR", "boom");
        return configured(A);
      },
    });
    expect(await screen.findByText(L.loading)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(L.error.loadFailed);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: L.retry }));
    const ref = await reference();
    expect(valueOf(ref, L.field.moq)).toBe("24");
  });

  it.each([
    ["403", new ApiError(403, "FORBIDDEN", "x"), L.error.forbidden],
    [
      "404 không có hồ sơ hàng tồn",
      new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "x"),
      L.error.noInventoryItem,
    ],
    ["404 biến thể", new ApiError(404, "NOT_FOUND", "x"), L.error.notFound],
  ])(
    "%s → câu đúng loại, không có nút thử lại, không giả 'chưa thiết lập'",
    async (_, error, message) => {
      setup([PRODUCT_PERMISSIONS.read], {
        [purchasingPath(A)]: () => {
          throw error;
        },
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.queryByRole("button", { name: L.retry })).toBeNull();
      expect(screen.queryByText(L.notSet)).toBeNull();
    },
  );
});

describe("VariantPurchasing — đổi biến thể / trạng thái", () => {
  it("chuyển A → B: không bao giờ hiện dữ liệu của A dưới B", async () => {
    let releaseB: () => void = () => undefined;
    const gateB = new Promise<void>((resolve) => (releaseB = resolve));
    const calls = installApi({
      permissions: [PRODUCT_PERMISSIONS.read],
      get: (url) => {
        if (url.endsWith("/base-price")) return { sku: "x", revision: 0 };
        if (url.endsWith("/media")) return [];
        if (url === purchasingPath(A)) return configured(A, { moq: 11 });
        return undefined;
      },
    });
    // `installApi` trả handler nguyên trạng (không await) → hoãn B ở tầng spy `api.get`
    const shared = calls.get.getMockImplementation();
    if (!shared) throw new Error("installApi must stub api.get");
    calls.get.mockImplementation((url: string, config?: AxiosRequestConfig) =>
      url === purchasingPath(B)
        ? gateB.then(() => ({ data: configured(B, { moq: 22 }) }))
        : shared(url, config),
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
    expect(valueOf(await reference(), L.field.moq)).toBe("11");
    // Nút đổi biến thể của test nằm sau lớp phủ của sheet (Radix đặt pointer-events: none) — chỉ bỏ
    // kiểm pointer-events cho đúng cú bấm này, thay cho việc trang chọn biến thể khác trong bảng
    const outside = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    await outside.click(screen.getByRole("button", { name: "next", hidden: true }));
    expect(await screen.findByText(L.loading)).toBeInTheDocument();
    expect(screen.queryByText("11")).toBeNull();
    releaseB();
    await waitFor(async () => expect(valueOf(await reference(), L.field.moq)).toBe("22"));
    expect(calls.get.mock.calls.some(([u]) => u === purchasingPath(B))).toBe(true);
  });

  it("sản phẩm ngừng kinh doanh + biến thể ngừng: vẫn đọc được, không có thao tác sửa", async () => {
    const obsolete = variantOf("v-a", "CUP-A", "OBSOLETE");
    setup(
      [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update],
      { [purchasingPath(obsolete)]: () => configured(obsolete, { defaultSupplierId: undefined }) },
      {
        variant: obsolete,
        acceptsChanges: false,
        productDiscontinued: true,
        productApproved: false,
      },
    );
    const ref = await reference();
    expect(valueOf(ref, L.field.moq)).toBe("24");
    expect(within(ref).queryByRole("button")).toBeNull();
  });
});
