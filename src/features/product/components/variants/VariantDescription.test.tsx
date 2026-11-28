import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, VARIANT_PERMISSIONS } from "@/constants";

import { installApi, renderApp } from "../../product-test-utils";
import { VariantDescription } from "./VariantDescription";

import type { Variant } from "../../variant-schemas";

const PRODUCT = "p-1";
const VARIANT_ID = "v-1";
const DESCRIPTION_PATH = `/products/${PRODUCT}/variants/${VARIANT_ID}/description`;

const variant = (description: string | null): Variant => ({
  variantId: VARIANT_ID,
  productId: PRODUCT,
  sku: "LY12-TRANG",
  name: "Ly 12oz trắng",
  status: "ACTIVE",
  defaultVariant: true,
  attributeSignature: null,
  position: 0,
  obsoletedAt: null,
  version: 1,
  options: [],
  inventoryItemId: null,
  description,
});

afterEach(() => vi.restoreAllMocks());

describe("VariantDescription — mô tả riêng của biến thể (ADR-0013)", () => {
  it("không có quyền sửa: chỉ xem; chưa có mô tả thì nói storefront dùng mô tả sản phẩm", () => {
    installApi({ permissions: [PRODUCT_PERMISSIONS.read] });
    renderApp(<VariantDescription productId={PRODUCT} variant={variant(null)} canEdit={false} />);
    expect(screen.getByText(/storefront dùng mô tả của sản phẩm/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu mô tả" })).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("có mô tả, chỉ xem: hiện HTML đã lọc", () => {
    installApi({ permissions: [PRODUCT_PERMISSIONS.read] });
    renderApp(
      <VariantDescription
        productId={PRODUCT}
        variant={variant("<p>Màu <strong>trắng</strong></p><script>x()</script>")}
        canEdit={false}
      />,
    );
    expect(screen.getByText("trắng").tagName).toBe("STRONG");
  });

  it("sửa được: chưa đổi gì thì không lưu được; lưu gửi PUT …/description với HTML của ô soạn", async () => {
    const { put } = installApi({
      permissions: [VARIANT_PERMISSIONS.update],
      put: (url, body) =>
        url === DESCRIPTION_PATH ? { ...variant(null), ...(body as object) } : undefined,
    });
    renderApp(<VariantDescription productId={PRODUCT} variant={variant("<p>Cũ</p>")} canEdit />);
    const save = await screen.findByRole("button", { name: "Lưu mô tả" });
    expect(save).toBeDisabled();

    // Đổi nội dung bằng thanh công cụ (jsdom thiếu API đo layout mà ProseMirror cần khi gõ phím).
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Danh sách chấm" }));
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(DESCRIPTION_PATH, {
        html: expect.stringContaining("<ul><li><p>Cũ</p></li></ul>"),
      }),
    );
  });
});
