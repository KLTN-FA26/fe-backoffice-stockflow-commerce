import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ITEM_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { ProductVariantsSection } from "../ProductVariantsSection";

import type { PermissionCode } from "@/lib/auth";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const variant = (over: Record<string, unknown> = {}) => ({
  variantId: "v-1",
  productId: PRODUCT,
  sku: "CUP-12OZ",
  name: "Ly 12oz",
  status: "ACTIVE",
  defaultVariant: true,
  attributeSignature: "SIZE=12OZ",
  position: 0,
  obsoletedAt: null,
  version: 0,
  options: [
    {
      attributeId: "a-size",
      attributeCode: "SIZE",
      valueId: "v-12oz",
      valueCode: "12OZ",
      label: "12oz",
    },
  ],
  // BE PR #119 `VariantResponse.inventoryItemId` — null khi SKU chưa có hồ sơ hàng tồn
  inventoryItemId: "item-1",
  ...over,
});
/** `GET /products/{id}/attributes`: một trục kích cỡ hai giá trị → sinh ma trận được. */
const attributes = {
  productId: PRODUCT,
  axes: [
    {
      attributeId: "a-size",
      code: "SIZE",
      name: "Kích cỡ",
      dataType: "SELECT",
      sortOrder: 0,
      options: [
        { valueId: "v-12oz", code: "12OZ", label: "12oz", active: true, usedByVariant: true },
        { valueId: "v-16oz", code: "16OZ", label: "16oz", active: true, usedByVariant: false },
      ],
    },
  ],
  descriptives: [],
};
/** BE `UomConversionResponse` — đơn vị cơ sở (cỡ / khối lượng của hồ sơ) rồi các đơn vị đóng gói. */
const unit = (over: Record<string, unknown> = {}) => ({
  id: "u-base",
  sku: "CUP-12OZ",
  unitOfMeasure: "EACH",
  factor: 1,
  base: true,
  weightKg: 0.02,
  defaultPurchase: true,
  active: true,
  version: 0,
  defaultShipping: false,
  ...over,
});
const CARTON = unit({
  id: "u-carton",
  unitOfMeasure: "CARTON",
  factor: 50,
  base: false,
  weightKg: "10.5",
  lengthCm: 40,
  widthCm: 30,
  heightCm: 25,
  defaultPurchase: false,
  version: 3,
  defaultShipping: true,
});
const UNITS_URL = `/products/${PRODUCT}/variants/v-1/uom-conversions`;
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

afterEach(() => vi.restoreAllMocks());
beforeAll(() => {
  // jsdom không có ResizeObserver mà Checkbox (Radix) của dialog quy cách thùng dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function mockBe(
  permissions: readonly PermissionCode[],
  variants = [variant()],
  units: unknown[] | Error = [unit(), CARTON],
) {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions") {
      return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
    }
    if (url === `/products/${PRODUCT}/variants`) {
      return {
        data: {
          items: variants,
          page: 0,
          size: 200,
          totalElements: variants.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };
    }
    if (url === `/products/${PRODUCT}/attributes`) return { data: attributes };
    if (url === UNITS_URL) {
      if (units instanceof Error) throw units;
      return { data: page(units) };
    }
    if (url === `/products/${PRODUCT}/variants/v-1/media`) return { data: [] };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string, body?: unknown) => {
    if (url.endsWith("/blocking")) return { data: variant({ status: "BLOCKED" }) };
    if (url === UNITS_URL) return { data: unit({ ...(body as object), id: "u-new", base: false }) };
    throw new Error(`Không có mock cho POST ${url}`);
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => {
    if (url === `${UNITS_URL}/u-carton`) return { data: { ...CARTON, ...(body as object) } };
    throw new Error(`Không có mock cho PUT ${url}`);
  });
  return { post, put, get: vi.mocked(api.get) };
}

function Harness({ acceptsChanges = true }: { acceptsChanges?: boolean }) {
  const query = useQuery({
    queryKey: ["variants", PRODUCT, "list"],
    queryFn: async () => {
      const { listVariants } = await import("../../variant-api");
      return listVariants(PRODUCT);
    },
  });
  // Mục Biến thể như trên trang chi tiết: nút thêm / sinh nằm trên dòng tiêu đề.
  return (
    <ProductVariantsSection
      productId={PRODUCT}
      productCode="CUP"
      productApproved
      acceptsChanges={acceptsChanges}
      customizable={false}
      canRead
      query={query}
    />
  );
}

function renderSection(props: { acceptsChanges?: boolean } = {}) {
  // useMyPermissions chỉ gọi /identity/me/permissions khi đã đăng nhập.
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@t.vn",
      roles: [],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

const C = UI_LABELS.cartonSpec;
const I = INVENTORY_ITEM_PERMISSIONS;
/** Seed BE V20260928006000: WAREHOUSE_MANAGER có toàn quyền `inventory-inventory-items`. */
const WAREHOUSE_MANAGER = [PRODUCT_PERMISSIONS.read, I.viewPage, I.read, I.update];

/** Mở panel của biến thể đầu tiên. */
async function openPanel(user = userEvent.setup()) {
  await user.click(await screen.findByText("CUP-12OZ"));
  return { user, panel: await screen.findByRole("dialog") };
}

describe("VariantsSection — biến thể thật (BE PR #71), không còn bảng SKU mock", () => {
  it("chỉ xem: hiện biến thể, không có nút Thêm / thao tác", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    expect(await screen.findByText("CUP-12OZ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).queryByRole("button", { name: "Tạm chặn" })).not.toBeInTheDocument();
    // Quy cách thùng đọc bằng `product-products:READ`; không có quyền sửa → không có nút
    expect(await within(panel).findByText("CARTON")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: C.edit })).not.toBeInTheDocument();
  });

  it("hiện nhãn tuỳ chọn (options) của biến thể trong bảng và panel; biến thể không có trục hiện —", async () => {
    mockBe(
      [PRODUCT_PERMISSIONS.read],
      [
        variant({
          options: [
            {
              attributeId: "a-color",
              attributeCode: "COLOR",
              valueId: "c",
              valueCode: "W",
              label: "Trắng",
            },
            {
              attributeId: "a-size",
              attributeCode: "SIZE",
              valueId: "s",
              valueCode: "12",
              label: "12oz",
            },
          ],
        }),
        variant({ variantId: "v-2", sku: "CUP-PLAIN", defaultVariant: false, options: [] }),
      ],
    );
    renderSection();
    expect(await screen.findByText("Trắng / 12oz")).toBeInTheDocument();
    expect(screen.queryByText(/SIZE=12OZ/)).not.toBeInTheDocument();
    const plain = screen.getByText("CUP-PLAIN").closest("tr");
    expect(plain && within(plain).getByText("—")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("COLOR:", { exact: false })).toBeInTheDocument();
    expect(within(panel).getByText("Trắng")).toBeInTheDocument();
  });

  it("UPDATE: tạm chặn phải qua dialog xác nhận rồi mới gọi /blocking; biến thể mặc định không có Ngừng dùng", async () => {
    const user = userEvent.setup();
    const { post } = mockBe([
      PRODUCT_PERMISSIONS.read,
      VARIANT_PERMISSIONS.update,
      VARIANT_PERMISSIONS.approve,
    ]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).queryByRole("button", { name: "Ngừng dùng" })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Tạm chặn" }));
    expect(post).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("dialog", { name: "Tạm chặn biến thể?" });
    await user.click(within(confirm).getByRole("button", { name: "Tạm chặn" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/products/${PRODUCT}/variants/v-1/blocking`),
    );
  });

  it("sinh tổ hợp: nút chỉ hiện khi có quyền tạo biến thể (product-variants:CREATE), sản phẩm nhận thay đổi và đã có trục", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.create]);
    renderSection();
    expect(await screen.findByRole("button", { name: /Sinh tổ hợp biến thể/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm biến thể/ })).toBeInTheDocument();
  });

  it("nút Sinh / Thêm biến thể nằm trên dòng tiêu đề mục Biến thể và mở đúng hộp thoại", async () => {
    const user = userEvent.setup();
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.create]);
    renderSection();
    const title = await screen.findByRole("button", { name: /^Biến thể \(1\)/ });
    const titleRow = title.parentElement;
    if (!titleRow) throw new Error("thiếu dòng tiêu đề mục Biến thể");
    expect(
      await within(titleRow).findByRole("button", { name: /Sinh tổ hợp biến thể/ }),
    ).toBeInTheDocument();
    await user.click(within(titleRow).getByRole("button", { name: /Thêm biến thể/ }));
    expect(await screen.findByRole("dialog", { name: "Thêm biến thể" })).toBeInTheDocument();
  });

  it("sản phẩm không nhận thay đổi (chờ duyệt / ngừng kinh doanh): không có nút thêm / sinh", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.create]);
    renderSection({ acceptsChanges: false });
    await screen.findByText("CUP-12OZ");
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sinh tổ hợp biến thể/ })).not.toBeInTheDocument();
  });

  it("panel nêu ngắn lý do khoá khi sản phẩm không nhận thay đổi, không còn nút Sửa / chuyển trạng thái", async () => {
    const user = userEvent.setup();
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.update, VARIANT_PERMISSIONS.approve]);
    renderSection({ acceptsChanges: false });
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText(UI_LABELS.product.variants.lockedHint)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Sửa/ })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Tạm chặn" })).not.toBeInTheDocument();
  });

  it("sản phẩm nhận thay đổi: panel không có câu khoá", async () => {
    const user = userEvent.setup();
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.update]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByRole("button", { name: /Sửa/ })).toBeInTheDocument();
    expect(
      within(panel).queryByText(UI_LABELS.product.variants.lockedHint),
    ).not.toBeInTheDocument();
  });

  it("chỉ có quyền sửa nội dung sản phẩm (product-products:UPDATE) thì không có nút thêm / sinh biến thể", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await screen.findByText("CUP-12OZ");
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sinh tổ hợp biến thể/ })).not.toBeInTheDocument();
  });

  // BE `ProductVariantService.requireChangeable` / `SkuUnitService.editableSku`: mọi thao tác ghi biến thể
  // và đơn vị tính bị từ chối khi sản phẩm chờ duyệt / đã ngừng kinh doanh.
  it("sản phẩm chờ duyệt: ẩn Sửa biến thể, Tạm chặn, Sửa quy cách thùng; vẫn xem được thùng", async () => {
    mockBe([
      PRODUCT_PERMISSIONS.read,
      PRODUCT_PERMISSIONS.update,
      PRODUCT_PERMISSIONS.approve,
      VARIANT_PERMISSIONS.update,
      VARIANT_PERMISSIONS.approve,
      VARIANT_PERMISSIONS.create,
    ]);
    renderSection({ acceptsChanges: false });
    const { panel } = await openPanel();
    expect(await within(panel).findByText("CARTON")).toBeInTheDocument();
    for (const name of [/^Sửa$/, "Tạm chặn", "Ngừng dùng", C.edit]) {
      expect(within(panel).queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
  });

  it("panel không còn mục giá bán / thông tin mua hàng (BE đã bỏ hai route này)", async () => {
    const { get } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    const { panel } = await openPanel();
    await within(panel).findByText("CARTON");
    expect(within(panel).queryByText("Giá bán")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Thông tin mua hàng")).not.toBeInTheDocument();
    const urls = get.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith("/base-price") || url.endsWith("/purchasing"))).toBe(
      false,
    );
  });
});

// Docs 01 §3 "Quy cách thùng" (BR-03): thùng = đơn vị quy đổi còn dùng, > 1 cái; BE `UomConversion.cartonOf`.
describe("VariantPanel — logistics & quy cách thùng (BE uom-conversions)", () => {
  it("hiện đơn vị cơ sở và thùng: số cái / thùng, kích thước, thể tích, khối lượng, giao mặc định", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    const { panel } = await openPanel();
    expect(await within(panel).findByText("CARTON")).toBeInTheDocument();
    expect(within(panel).getByText("EACH")).toBeInTheDocument();
    expect(within(panel).getByText(C.unitsValue("50", "EACH"))).toBeInTheDocument();
    expect(within(panel).getByText(C.sizeValue("40", "30", "25"))).toBeInTheDocument();
    expect(within(panel).getByText(C.volumeValue("0,030"))).toBeInTheDocument();
    expect(within(panel).getByText(C.weightValue("10,5"))).toBeInTheDocument();
    expect(within(panel).getByText(C.defaultShipping).nextElementSibling).toHaveTextContent(C.yes);
    expect(within(panel).queryByText(C.notMeasured)).not.toBeInTheDocument();
    // Không có quyền kho → không có lối sang hồ sơ hàng tồn
    expect(within(panel).queryByRole("link", { name: C.openInventoryItem })).toBeNull();
  });

  it("có quyền đọc hồ sơ hàng tồn: link sang trang hồ sơ của SKU", async () => {
    mockBe(WAREHOUSE_MANAGER);
    renderSection();
    const { panel } = await openPanel();
    expect(await within(panel).findByRole("link", { name: C.openInventoryItem })).toHaveAttribute(
      "href",
      "/admin/inventory-items/item-1",
    );
  });

  it("SKU chưa có hồ sơ hàng tồn (inventoryItemId null): không có link", async () => {
    mockBe(WAREHOUSE_MANAGER, [variant({ inventoryItemId: null })]);
    renderSection();
    const { panel } = await openPanel();
    await within(panel).findByText("CARTON");
    expect(within(panel).queryByRole("link", { name: C.openInventoryItem })).toBeNull();
  });

  it("sửa thùng: PUT đủ trường kèm version, giữ defaultPurchase, active=true", async () => {
    const { put } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    const { user, panel } = await openPanel();
    await user.click(await within(panel).findByRole("button", { name: C.edit }));
    const dialog = await screen.findByRole("dialog", { name: C.dialog.editTitle("CARTON") });
    const units = within(dialog).getByLabelText(C.dialog.unitsPerCarton);
    expect(units).toHaveValue("50");
    await user.clear(units);
    await user.type(units, "60");
    await user.click(within(dialog).getByRole("button", { name: C.dialog.submitEdit }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`${UNITS_URL}/u-carton`, {
        unitOfMeasure: "CARTON",
        factor: 60,
        lengthCm: 40,
        widthCm: 30,
        heightCm: 25,
        weightKg: 10.5,
        defaultShipping: true,
        version: 3,
        defaultPurchase: false,
        active: true,
      }),
    );
  });

  it("chưa có thùng: báo thiếu quy cách, khai báo bằng POST (mặc định CARTON, giao mặc định)", async () => {
    const { post } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update], undefined, [
      unit({ defaultShipping: true }),
    ]);
    renderSection();
    const { user, panel } = await openPanel();
    expect(await within(panel).findByText(C.none)).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: C.declare }));
    const dialog = await screen.findByRole("dialog", { name: C.dialog.createTitle });
    const submit = within(dialog).getByRole("button", { name: C.dialog.submitCreate });
    // 1 cái / thùng không phải quy cách thùng (BR-03, `cartonCandidate`: factor > 1)
    await user.type(within(dialog).getByLabelText(C.dialog.unitsPerCarton), "1");
    expect(await within(dialog).findByText(C.validation.unitsPerCarton)).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(C.dialog.unitsPerCarton), "000");
    await user.type(within(dialog).getByLabelText(C.dialog.lengthCm), "40.5");
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(UNITS_URL, {
        unitOfMeasure: "CARTON",
        factor: 1000,
        lengthCm: 40.5,
        widthCm: null,
        heightCm: null,
        weightKg: null,
        defaultShipping: true,
        defaultPurchase: false,
      }),
    );
  });

  it("thùng thiếu kích thước / khối lượng: cảnh báo chưa in được nhãn giao", async () => {
    mockBe([PRODUCT_PERMISSIONS.read], undefined, [
      unit(),
      { ...CARTON, lengthCm: undefined, weightKg: undefined },
    ]);
    renderSection();
    const { panel } = await openPanel();
    expect(await within(panel).findByText(C.notMeasured)).toBeInTheDocument();
  });

  it("nhiều đơn vị đóng gói, không cái nào giao mặc định: không đoán thùng, cho sửa từng đơn vị", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update], undefined, [
      unit(),
      { ...CARTON, defaultShipping: false },
      { ...CARTON, id: "u-box", unitOfMeasure: "BOX", factor: 10, defaultShipping: false },
    ]);
    renderSection();
    const { panel } = await openPanel();
    expect(await within(panel).findByText(C.ambiguous)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: C.editUnit("CARTON") })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: C.editUnit("BOX") })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: C.declare })).not.toBeInTheDocument();
  });

  it("lỗi tải: 403 báo không có quyền (không thử lại); lỗi máy chủ có nút Thử lại", async () => {
    mockBe([PRODUCT_PERMISSIONS.read], undefined, new ApiError(403, "FORBIDDEN", "no"));
    const first = renderSection();
    const { panel } = await openPanel();
    expect(await within(panel).findByText(C.error.forbidden)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: C.retry })).not.toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();

    mockBe([PRODUCT_PERMISSIONS.read], undefined, new ApiError(500, "INTERNAL_ERROR", "boom"));
    renderSection();
    const second = await openPanel();
    expect(await within(second.panel).findByText(C.error.loadFailed)).toBeInTheDocument();
    expect(within(second.panel).getByRole("button", { name: C.retry })).toBeInTheDocument();
  });
});
