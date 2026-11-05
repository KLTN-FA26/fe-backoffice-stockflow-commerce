/**
 * Form sản phẩm với dữ liệu thật của BE (chỉ giả `api`): ô thương hiệu / danh mục đổ đúng khi sửa, đủ
 * mọi cấp và mọi trang danh mục / thương hiệu.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { goToLastStep, installApi, pickOption, renderApp } from "../product-test-utils";
import { ProductCreate } from "./ProductCreate";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const BRAND = "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b11";
const LATE_BRAND = "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b22";

const category = (code: string, name: string, depth: number, active = true) => ({
  categoryId: `cat-${code}`,
  parentId: null,
  code,
  name,
  slug: code.toLowerCase(),
  path: `/${["A", "B", "C", "D", "E"].slice(0, depth).join("/")}${depth ? "/" : ""}${code}`,
  depth,
  sortOrder: 0,
  active,
});
const DEEP = category("DEEP", "Ly giấy cấp 5", 4);
const brand = (brandId: string, name: string, active = true) => ({
  brandId,
  code: name.toUpperCase().replace(/\W/g, ""),
  name,
  slug: name.toLowerCase(),
  active,
});

/** Trang `n` (đánh số từ 0) của một danh sách hai trang — BE `PageResponse`. */
const pageOf = (pages: unknown[][], config: unknown) => {
  const params = (config as { params?: { page?: number } } | undefined)?.params;
  const index = typeof params?.page === "number" ? params.page : 0;
  return {
    items: pages[index] ?? [],
    page: index,
    size: 200,
    totalElements: pages.flat().length,
    totalPages: pages.length,
    hasNext: index + 1 < pages.length,
    hasPrevious: index > 0,
  };
};

const beProduct = {
  productId: PRODUCT,
  code: "TOTE",
  name: "Túi tote",
  nameEn: "Tote bag",
  brandId: BRAND,
  brandName: "Thương hiệu A",
  categoryId: DEEP.categoryId,
  shortDescription: "",
  description: "",
  descriptionEn: "",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "DRAFT",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
};

function setup(
  permission: string,
  overrides: { product?: () => unknown; put?: () => unknown } = {},
) {
  return installApi({
    permissions: [permission],
    get: (url, config) => {
      if (url === `/products/${PRODUCT}`) return overrides.product?.() ?? beProduct;
      // Danh mục cấp 5 và thương hiệu thứ hai nằm ở trang thứ hai
      if (url === "/categories") {
        return pageOf([[category("A", "Gốc", 0), category("B", "Cấp 2", 1)], [DEEP]], config);
      }
      if (url === "/brands") {
        return pageOf([[brand(BRAND, "Thương hiệu A")], [brand(LATE_BRAND, "Zeta")]], config);
      }
      if (url === "/attributes") return pageOf([[]], config);
      return undefined;
    },
    put: (url) =>
      url === `/products/${PRODUCT}`
        ? (overrides.put?.() ?? { ...beProduct, version: 2 })
        : undefined,
  });
}

beforeEach(() => pushMock.mockClear());
afterEach(() => vi.restoreAllMocks());

// Luồng wizard nhiều bước (Radix Select + chuyển bước) chậm khi cả bộ test chạy song song → 15 s
// như PurchaseOrderCreate.test.
describe("ProductCreate — ô thương hiệu / danh mục", { timeout: 15_000 }, () => {
  it("sửa: thương hiệu / danh mục đổ đúng sau khi tải và Lưu gửi lại đúng id", async () => {
    const { put } = setup(PRODUCT_PERMISSIONS.update);
    const user = userEvent.setup();
    renderApp(<ProductCreate productId={PRODUCT} />);
    await screen.findByDisplayValue("Túi tote");
    expect(screen.getByRole("combobox", { name: /Thương hiệu/ })).toHaveTextContent(
      "Thương hiệu A",
    );
    // Ô đã đóng chỉ hiện tên — không chép khoảng thụt lề của danh sách
    expect(screen.getByRole("combobox", { name: /Danh mục/ }).textContent).toBe("Ly giấy cấp 5");

    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `/products/${PRODUCT}`,
        expect.objectContaining({ brandId: BRAND, categoryId: DEEP.categoryId, version: 1 }),
      ),
    );
  });

  it("tạo: chọn được danh mục cấp 5 (tìm trong cây) và thương hiệu ở trang thứ hai", async () => {
    setup(PRODUCT_PERMISSIONS.create);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await user.click(await screen.findByRole("combobox", { name: /Danh mục/ }));
    await user.type(screen.getByRole("textbox", { name: /Tìm danh mục/ }), "cấp 5");
    const deep = await screen.findByRole("treeitem", { name: /Ly giấy cấp 5/ });
    await user.click(deep);
    expect(screen.getByRole("combobox", { name: /Danh mục/ }).textContent).toBe("Ly giấy cấp 5");

    await pickOption(user, /Thương hiệu/, "Zeta");
    expect(screen.getByRole("combobox", { name: /Thương hiệu/ })).toHaveTextContent("Zeta");
  });
});

describe("ProductCreate — thương hiệu / danh mục đã ngưng dùng", () => {
  const OLD_BRAND = "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b33";
  const OTHER_OLD = "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b44";
  const OLD_CATEGORY = category("OLD", "Danh mục cũ", 0, false);
  /** Như BE: `active=true` chỉ trả bản ghi đang dùng, bỏ trống thì trả hết. */
  const byActive = <T extends { active: boolean }>(rows: T[], config: unknown) => {
    const active = (config as { params?: { active?: boolean } } | undefined)?.params?.active;
    return active === undefined ? rows : rows.filter((row) => row.active === active);
  };

  it("sửa: ô chọn vẫn hiện thương hiệu / danh mục hiện tại đã ngưng, không mời chọn cái đã ngưng khác", async () => {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.update],
      get: (url, config) => {
        if (url === `/products/${PRODUCT}`) {
          return { ...beProduct, brandId: OLD_BRAND, categoryId: OLD_CATEGORY.categoryId };
        }
        if (url === "/categories") {
          return pageOf([byActive([category("A", "Gốc", 0), OLD_CATEGORY], config)], config);
        }
        if (url === "/brands") {
          const rows = [
            brand(BRAND, "Thương hiệu A"),
            brand(OLD_BRAND, "Hiệu cũ", false),
            brand(OTHER_OLD, "Hiệu bỏ", false),
          ];
          return pageOf([byActive(rows, config)], config);
        }
        if (url === "/attributes") return pageOf([[]], config);
        return undefined;
      },
    });
    const user = userEvent.setup();
    renderApp(<ProductCreate productId={PRODUCT} />);
    await screen.findByDisplayValue("Túi tote");
    const inactive = UI_LABELS.product.inactiveOption;
    expect(screen.getByRole("combobox", { name: /Thương hiệu/ })).toHaveTextContent(
      `Hiệu cũ${inactive}`,
    );
    expect(screen.getByRole("combobox", { name: /Danh mục/ })).toHaveTextContent(
      `Danh mục cũ${inactive}`,
    );
    await user.click(screen.getByRole("combobox", { name: /Thương hiệu/ }));
    expect(await screen.findByRole("option", { name: "Thương hiệu A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Hiệu bỏ/ })).not.toBeInTheDocument();
  });
});

describe("ProductCreate — sửa bị 409 OPTIMISTIC_LOCK", { timeout: 15_000 }, () => {
  it("giữ nội dung đang nhập, nêu ô người khác vừa đổi, lần lưu sau gửi version mới", async () => {
    // Người khác lưu mô tả trước: từ lúc đó BE trả bản version 2 và từ chối PUT version 1
    let otherSaved = false;
    const latest = { ...beProduct, description: "Mô tả của người khác", version: 2 };
    const { put } = setup(PRODUCT_PERMISSIONS.update, {
      product: () => (otherSaved ? latest : beProduct),
      put: () => {
        if (!otherSaved) {
          otherSaved = true;
          throw new ApiError(409, "OPTIMISTIC_LOCK", "The record changed meanwhile");
        }
        return { ...latest, name: "Bản của tôi", version: 3 };
      },
    });
    const user = userEvent.setup();
    renderApp(<ProductCreate productId={PRODUCT} />);
    const name = await screen.findByDisplayValue("Túi tote");
    await user.clear(name);
    await user.type(name, "Bản của tôi");
    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByText(/người khác đổi: Mô tả tiếng Việt/)).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith(
      `/products/${PRODUCT}`,
      expect.objectContaining({ version: 1, name: "Bản của tôi" }),
    );
    // Không nạp đè bản server lên công người dùng
    expect(screen.getByLabelText(/^Tên sản phẩm/)).toHaveValue("Bản của tôi");
    expect(screen.getByLabelText("Mô tả tiếng Việt")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    // Lưu lại bản của người dùng (mô tả để trống → không gửi), với version mới đã tải lại
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(
        `/products/${PRODUCT}`,
        expect.objectContaining({ version: 2, name: "Bản của tôi", description: undefined }),
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/admin/products/${PRODUCT}`));
  });
});
