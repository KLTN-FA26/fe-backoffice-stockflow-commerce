import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, VARIANT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../product-test-utils";
import { ProductAttributesSection } from "./ProductAttributesSection";

import type { ProductStatus } from "../types";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const attributes = {
  productId: PRODUCT,
  axes: [
    {
      attributeId: "a-color",
      code: "COLOR",
      name: "Màu sắc",
      dataType: "COLOR",
      sortOrder: 0,
      options: [
        {
          valueId: "w",
          code: "WHT",
          label: "Trắng",
          hexColor: "#FFFFFF",
          valueNumber: null,
          active: true,
          usedByVariant: true,
        },
        {
          valueId: "o",
          code: "OLD",
          label: "Cũ",
          hexColor: "#111111",
          valueNumber: null,
          active: false,
          usedByVariant: false,
        },
      ],
    },
  ],
  descriptives: [
    {
      attributeId: "t",
      code: "MATERIAL",
      name: "Chất liệu",
      dataType: "TEXT",
      unit: null,
      sortOrder: 0,
      values: [],
      text: "Cotton",
      number: null,
      bool: null,
    },
    {
      attributeId: "n",
      code: "WEIGHT",
      name: "Khối lượng",
      dataType: "NUMBER",
      unit: "kg",
      sortOrder: 1,
      values: [],
      text: null,
      number: 1.5,
      bool: null,
    },
    {
      attributeId: "b",
      code: "ORGANIC",
      name: "Hữu cơ",
      dataType: "BOOLEAN",
      unit: null,
      sortOrder: 2,
      values: [],
      text: null,
      number: null,
      bool: false,
    },
    {
      attributeId: "s",
      code: "ORIGIN",
      name: "Xuất xứ",
      dataType: "SELECT",
      unit: null,
      sortOrder: 3,
      values: [{ valueId: "vn", code: "VN", label: "Việt Nam", active: true }],
      text: null,
      number: null,
      bool: null,
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

function setup(permissions: string[]) {
  installApi({
    permissions,
    get: (url) => (url === `/products/${PRODUCT}/attributes` ? attributes : undefined),
  });
}
const renderSection = (status: ProductStatus) =>
  renderApp(<ProductAttributesSection productId={PRODUCT} status={status} />);

describe("ProductAttributesSection — GET /products/{id}/attributes", () => {
  it("hiện trục (giá trị kèm màu, giá trị đã vô hiệu) và thuộc tính mô tả theo từng loại", async () => {
    setup([]);
    renderSection("Approved");
    expect(await screen.findByText("Trắng")).toBeInTheDocument();
    expect(screen.getByText("Cũ")).toBeInTheDocument();
    expect(screen.getByText("(đã vô hiệu)")).toBeInTheDocument();
    expect(screen.getByText("Cotton")).toBeInTheDocument();
    expect(screen.getByText("1.5 kg")).toBeInTheDocument();
    expect(screen.getByText("Không")).toBeInTheDocument();
    expect(screen.getByText("Việt Nam")).toBeInTheDocument();
  });

  it("nút Sửa trục cần product-variants:UPDATE; Sửa thuộc tính cần product-products:UPDATE — hai quyền khác nhau", async () => {
    setup([VARIANT_PERMISSIONS.update]);
    renderSection("Draft");
    await screen.findByText("Trắng");
    expect(screen.getByRole("button", { name: /Sửa trục/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa thuộc tính/ })).not.toBeInTheDocument();
  });

  it("chỉ có quyền sửa nội dung sản phẩm: sửa được thuộc tính mô tả, không sửa được trục", async () => {
    setup([PRODUCT_PERMISSIONS.update]);
    renderSection("Approved");
    await screen.findByText("Trắng");
    expect(screen.getByRole("button", { name: /Sửa thuộc tính/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa trục/ })).not.toBeInTheDocument();
  });

  it.each(["Pending Approval", "Discontinued"] as const)(
    "%s: không nhận thay đổi → không có nút sửa dù có đủ quyền",
    async (status) => {
      setup([VARIANT_PERMISSIONS.update, PRODUCT_PERMISSIONS.update]);
      renderSection(status);
      await screen.findByText("Trắng");
      expect(screen.queryByRole("button", { name: /Sửa/ })).not.toBeInTheDocument();
    },
  );

  it("đã duyệt / tạm ngưng vẫn sửa được (BE chỉ chặn chờ duyệt và ngừng kinh doanh)", async () => {
    setup([VARIANT_PERMISSIONS.update, PRODUCT_PERMISSIONS.update]);
    renderSection("Inactive");
    await screen.findByText("Trắng");
    expect(screen.getAllByRole("button", { name: /Sửa/ })).toHaveLength(2);
  });

  it("sản phẩm chưa có trục / mô tả: nói rõ, không để trống", async () => {
    installApi({
      permissions: [],
      get: (url) =>
        url === `/products/${PRODUCT}/attributes`
          ? { productId: PRODUCT, axes: [], descriptives: [] }
          : undefined,
    });
    renderSection("Draft");
    expect(await screen.findByText(/Chưa có trục/)).toBeInTheDocument();
    expect(screen.getByText("Chưa có thuộc tính mô tả.")).toBeInTheDocument();
  });

  it("lỗi tải: báo bằng tiếng Việt", async () => {
    installApi({
      permissions: [],
      get: (url) => {
        if (url === `/products/${PRODUCT}/attributes`)
          throw new ApiError(404, "PRODUCT_NOT_FOUND", "x");
        return undefined;
      },
    });
    renderSection("Draft");
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy sản phẩm.");
  });
});
