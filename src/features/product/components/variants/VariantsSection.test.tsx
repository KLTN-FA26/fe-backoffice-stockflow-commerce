import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, VARIANT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { VariantsSection } from "./VariantsSection";

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
  ...over,
});
const logistics = {
  skuId: "v-1",
  sku: "CUP-12OZ",
  version: 2,
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
const inventoryControl = {
  skuId: "v-1",
  sku: "CUP-12OZ",
  unitOfMeasure: "EACH",
  version: 4,
  reorderPoint: 20,
  safetyStock: 5,
  removalStrategy: "FEFO",
  trackingMode: "NONE",
  expiryTracked: false,
  maxShelfLifeDays: null,
  usableOnHand: 12,
  reorderRequired: true,
  belowSafetyStock: false,
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
    if (url === `/products/${PRODUCT}/skus/v-1/logistics`) return { data: logistics };
    if (url === `/products/${PRODUCT}/skus/v-1/inventory-control`)
      return { data: inventoryControl };
    if (url === `/products/${PRODUCT}/skus/CUP-12OZ/base-price`) return { data: skuPrice };
    if (url === `/products/${PRODUCT}/variants/v-1/media`) return { data: [] };
    throw new Error(`Không có mock cho GET ${url}`);
  });
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string) => {
    if (url.endsWith("/blocking")) return { data: variant({ status: "BLOCKED" }) };
    throw new Error(`Không có mock cho POST ${url}`);
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string) => {
    if (url.endsWith("/inventory-control")) return { data: { ...inventoryControl, version: 5 } };
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
    return { data: { ...logistics, version: 3 } };
  });
  return { post, put };
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
  return (
    <VariantsSection
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

describe("VariantsSection — biến thể thật (BE PR #71), không còn bảng SKU mock", () => {
  it("chỉ xem: hiện biến thể, không có nút Thêm / thao tác", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    expect(await screen.findByText("CUP-12OZ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).queryByRole("button", { name: "Tạm chặn" })).not.toBeInTheDocument();
    expect(await within(panel).findByText("50/gói", { exact: false })).toBeInTheDocument();
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

  it("sửa logistics gửi version của lần đọc (chống ghi đè)", async () => {
    const user = userEvent.setup();
    const { put } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await user.click(await within(panel).findByRole("button", { name: /Sửa logistics/ }));
    await user.clear(within(panel).getByLabelText("Khối lượng (kg)"));
    await user.type(within(panel).getByLabelText("Khối lượng (kg)"), "0.03");
    await user.click(within(panel).getByRole("button", { name: "Lưu logistics" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `/products/${PRODUCT}/skus/v-1/logistics`,
        expect.objectContaining({
          version: 2,
          weightKg: 0.03,
          packSize: 50,
          storageClass: "NORMAL",
        }),
      ),
    );
  });

  it("sinh tổ hợp: nút chỉ hiện khi có quyền tạo biến thể (product-variants:CREATE), sản phẩm nhận thay đổi và đã có trục", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, VARIANT_PERMISSIONS.create]);
    renderSection();
    expect(await screen.findByRole("button", { name: /Sinh tổ hợp biến thể/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm biến thể/ })).toBeInTheDocument();
  });

  it("chỉ có quyền sửa nội dung sản phẩm (product-products:UPDATE) thì không có nút thêm / sinh biến thể", async () => {
    mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await screen.findByText("CUP-12OZ");
    expect(screen.queryByRole("button", { name: /Thêm biến thể/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sinh tổ hợp biến thể/ })).not.toBeInTheDocument();
  });

  it("panel hiện chính sách tồn kho + giá bán của SKU; sửa chính sách gửi version của lần đọc", async () => {
    const user = userEvent.setup();
    const { put } = mockBe([PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update]);
    renderSection();
    await user.click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    expect(await within(panel).findByText("Điểm đặt hàng lại")).toBeInTheDocument();
    expect(
      within(panel).getByText(/Dưới tồn an toàn|Đã tới điểm đặt hàng lại/),
    ).toBeInTheDocument();
    expect(await within(panel).findByText("Giá bán cơ sở")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: /Sửa chính sách tồn kho/ }));
    const reorder = within(panel).getByLabelText("Điểm đặt hàng lại");
    await user.clear(reorder);
    await user.type(reorder, "30");
    await user.click(within(panel).getByRole("button", { name: "Lưu chính sách" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/skus/v-1/inventory-control`, {
        version: 4,
        reorderPoint: 30,
        safetyStock: 5,
        removalStrategy: "FEFO",
        trackingMode: "NONE",
        expiryTracked: false,
        maxShelfLifeDays: null,
      }),
    );
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

  it("giá không phải số nguyên VND → không gửi; chỉ đọc thì không có nút sửa chính sách / giá", async () => {
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

  it("chỉ đọc: panel không có Sửa chính sách / Sửa giá", async () => {
    mockBe([PRODUCT_PERMISSIONS.read]);
    renderSection();
    await userEvent.setup().click(await screen.findByText("CUP-12OZ"));
    const panel = await screen.findByRole("dialog");
    await within(panel).findByText("Giá bán cơ sở");
    expect(
      within(panel).queryByRole("button", { name: /Sửa chính sách tồn kho|Sửa giá|Đặt giá/ }),
    ).not.toBeInTheDocument();
  });

  // BE `ProductVariantService.requireChangeable`: mọi thao tác ghi biến thể bị từ chối khi sản phẩm
  // chờ duyệt / đã ngừng kinh doanh. BE `CatalogCommerceService.price` chỉ từ chối DISCONTINUED.
  it("sản phẩm chờ duyệt: ẩn Sửa biến thể, Tạm chặn, Sửa logistics / chính sách tồn kho — nhưng vẫn đặt giá được", async () => {
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
    for (const name of [
      /^Sửa$/,
      "Tạm chặn",
      "Ngừng dùng",
      /Sửa logistics/,
      /Sửa chính sách tồn kho/,
    ]) {
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
