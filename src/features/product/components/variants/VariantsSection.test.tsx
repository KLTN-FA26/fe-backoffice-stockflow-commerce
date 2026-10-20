import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ITEM_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
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
const logistics = {
  unitOfMeasure: "EACH",
  barcode: null,
  weightKg: 0.02,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  packageWeightKg: null,
  packageLengthCm: null,
  packageWidthCm: null,
  packageHeightCm: null,
  packageCount: 1,
  packSize: 50,
  storageClass: "NORMAL",
  requiresAdultSignature: false,
  shippingRestrictionNote: null,
  qcRequired: false,
};

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
/** BE PR #119 `InventoryItemResponse` (`GET /inventory/items/{id}`) — version là của hồ sơ. */
const item = {
  id: "item-1",
  sku: "CUP-12OZ",
  version: 2,
  logistics,
  policy: { reorderPoint: null, safetyStock: null, maxQty: null, removalStrategy: "FIFO" },
  evaluation: { usableOnHand: 0, reorderRequired: null, belowSafetyStock: null },
};

const skuPrice = {
  sku: "CUP-12OZ",
  revision: 6,
  basePrice: 149000,
  baseCurrency: "VND",
  effectivePrice: 139000,
  effectiveCurrency: "VND",
};

afterEach(() => vi.restoreAllMocks());

function mockBe(permissions: readonly PermissionCode[], variants = [variant()]) {
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
    if (url === "/inventory/items/item-1") return { data: item };
    if (url === `/products/${PRODUCT}/skus/CUP-12OZ/base-price`) return { data: skuPrice };
    if (url === `/products/${PRODUCT}/variants/v-1/media`) return { data: [] };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string) => {
    if (url.endsWith("/blocking")) return { data: variant({ status: "BLOCKED" }) };
    throw new Error(`Không có mock cho POST ${url}`);
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string) => {
    if (url.endsWith("/base-price")) {
      return {
        data: {
          productId: PRODUCT,
          slug: "ly",
          seoTitle: null,
          seoDescription: null,
          revision: 7,
          projectedRevision: 7,
          published: false,
          projectionPending: false,
        },
      };
    }
    throw new Error(`Không có mock cho PUT ${url}`);
  });
  return { post, put, get: vi.mocked(api.get) };
}

function Harness({
  acceptsChanges = true,
  productDiscontinued = false,
}: {
  acceptsChanges?: boolean;
  productDiscontinued?: boolean;
}) {
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
      productDiscontinued={productDiscontinued}
      query={query}
    />
  );
}

function renderSection(props: { acceptsChanges?: boolean; productDiscontinued?: boolean } = {}) {
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

const S = UI_LABELS.inventoryItem.variantSummary;
const F = UI_LABELS.inventoryItem.field;
const I = INVENTORY_ITEM_PERMISSIONS;
/** Seed BE V20260928006000: WAREHOUSE_MANAGER có toàn quyền `inventory-inventory-items`. */
const WAREHOUSE_MANAGER = [PRODUCT_PERMISSIONS.read, I.viewPage, I.read, I.update];
/** Role catalog: sửa / duyệt sản phẩm và biến thể; seed BE không cấp `inventory-inventory-items`. */
const ECOMMERCE_ADMIN = [
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
  PRODUCT_PERMISSIONS.approve,
  VARIANT_PERMISSIONS.create,
  VARIANT_PERMISSIONS.update,
  VARIANT_PERMISSIONS.approve,
];

const calledInventoryItems = (get: ReturnType<typeof mockBe>["get"]) =>
  get.mock.calls.some(([url]) => String(url).startsWith("/inventory/items"));

describe("VariantsSection — biến thể thật (BE PR #71), không còn bảng SKU mock", () => {
  it("chỉ xem: hiện biến thể, không có nút Thêm / thao tác", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    expect(await screen.findByText("CUP-12OZ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).queryByRole("button", { name: "Tạm chặn" })).not.toBeInTheDocument();
    expect(await within(panel).findByText(S.noPermission)).toBeInTheDocument();
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

  it("đặt giá gửi MÃ SKU (không phải variantId), revision của lần đọc, VND", async () => {
    const user = userEvent.setup();
    const { put } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await user.click(await within(panel).findByRole("button", { name: "Sửa giá" }));
    const price = within(panel).getByLabelText(/Giá bán cơ sở \(VND\)/);
    await user.clear(price);
    await user.type(price, "159000");
    await user.click(within(panel).getByRole("button", { name: "Lưu giá" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/skus/CUP-12OZ/base-price`, {
        revision: 6,
        price: 159000,
        currency: "VND",
      }),
    );
  });

  it("giá không phải số nguyên VND → không gửi", async () => {
    const user = userEvent.setup();
    const { put } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await user.click(await within(panel).findByRole("button", { name: "Sửa giá" }));
    const price = within(panel).getByLabelText(/Giá bán cơ sở \(VND\)/);
    await user.clear(price);
    await user.type(price, "12.5");
    expect(within(panel).getByRole("button", { name: "Lưu giá" })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("chỉ đọc: panel không có Sửa giá / Đặt giá", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await within(panel).findByText("Giá bán cơ sở");
    expect(
      within(panel).queryByRole("button", { name: /Sửa giá|Đặt giá/ }),
    ).not.toBeInTheDocument();
  });

  // BE `ProductVariantService.requireChangeable`: mọi thao tác ghi biến thể bị từ chối khi sản phẩm
  // chờ duyệt / đã ngừng kinh doanh. BE `CatalogCommerceService.price` chỉ từ chối DISCONTINUED.
  it("sản phẩm chờ duyệt: ẩn Sửa biến thể, Tạm chặn — nhưng vẫn đặt giá được", async () => {
    mockBe([
      PRODUCT_PERMISSIONS.read,
      PRODUCT_PERMISSIONS.update,
      PRODUCT_PERMISSIONS.approve,
      VARIANT_PERMISSIONS.update,
      VARIANT_PERMISSIONS.approve,
      VARIANT_PERMISSIONS.create,
    ]);
    renderSection({ acceptsChanges: false });
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByRole("button", { name: "Sửa giá" })).toBeInTheDocument();
    for (const name of [/^Sửa$/, "Tạm chặn", "Ngừng dùng"]) {
      expect(within(panel).queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
  });

  it("sản phẩm đã ngừng kinh doanh: không đặt giá được", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection({ acceptsChanges: false, productDiscontinued: true });
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await within(panel).findByText("Giá bán cơ sở");
    expect(within(panel).queryByRole("button", { name: "Sửa giá" })).not.toBeInTheDocument();
  });
});

// BE PR #119: logistics + chính sách tồn rời khỏi sản phẩm sang `/inventory/items/{id}` (quyền
// `inventory-inventory-items`, không theo trạng thái sản phẩm / biến thể). Panel chỉ tóm tắt + link.
describe("VariantPanel — tóm tắt hồ sơ hàng tồn (BE PR #119)", () => {
  it("WAREHOUSE_MANAGER: 4 dòng tóm tắt + link sang hồ sơ tồn kho, không sửa tại đây", async () => {
    mockBe(WAREHOUSE_MANAGER);
    renderSection();
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByText("EACH")).toBeInTheDocument();
    for (const label of [F.unitOfMeasure, F.barcode, UI_LABELS.inventoryItem.weightView]) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(within(panel).getByText(F.storageClass)).toBeInTheDocument();
    expect(
      within(panel).getByText(UI_LABELS.inventoryItem.storageClass.NORMAL),
    ).toBeInTheDocument();
    expect(within(panel).getByText(S.weightValue(0.02))).toBeInTheDocument();
    expect(within(panel).getByText(UI_LABELS.inventoryItem.notProvided)).toBeInTheDocument();
    expect(within(panel).queryByText(F.packSize)).not.toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: S.openInInventory })).toHaveAttribute(
      "href",
      "/admin/inventory-items/item-1",
    );
    expect(within(panel).queryByRole("button", { name: /logistics|chính sách/i })).toBeNull();
  });

  it("ECOMMERCE_ADMIN (role catalog, không có quyền kho): báo không có quyền, không gọi /inventory/items", async () => {
    const { get } = mockBe(ECOMMERCE_ADMIN);
    renderSection();
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText(S.noPermission)).toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: S.openInInventory })).toBeNull();
    expect(calledInventoryItems(get)).toBe(false);
  });

  it("SKU chưa có hồ sơ tồn kho (inventoryItemId null) → báo, không gọi /inventory/items", async () => {
    const { get } = mockBe(WAREHOUSE_MANAGER, [variant({ inventoryItemId: null })]);
    renderSection();
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText(S.noItem)).toBeInTheDocument();
    expect(calledInventoryItems(get)).toBe(false);
  });

  it("sản phẩm Chờ duyệt vẫn thấy link hồ sơ tồn kho — BE #119 không chặn theo trạng thái SP", async () => {
    mockBe([...WAREHOUSE_MANAGER, VARIANT_PERMISSIONS.update]);
    renderSection({ acceptsChanges: false });
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByRole("link", { name: S.openInInventory })).toBeInTheDocument();
    // Biến thể vẫn khoá theo trạng thái sản phẩm (BE `requireChangeable`).
    expect(within(panel).queryByRole("button", { name: /^Sửa$/ })).not.toBeInTheDocument();
  });
});
