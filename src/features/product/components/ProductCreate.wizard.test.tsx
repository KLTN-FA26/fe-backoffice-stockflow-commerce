/**
 * Wizard tạo / sửa sản phẩm: chặn qua bước khi còn lỗi, bản sửa không có bước trục, lỗi BE theo ô
 * đưa về đúng bước, bước rà soát tóm tắt đúng. Form + hook thật, chỉ giả `api`.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { goToLastStep, installApi, pickOption, renderApp } from "../product-test-utils";
import { ProductCreate } from "./ProductCreate";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "c5ad8d15-e378-4ea7-8c75-b5c012508ced";
const BRAND = "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b11";
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const beProduct = {
  productId: PRODUCT,
  code: "TOTE",
  name: "Túi tote",
  nameEn: "Tote bag",
  brandId: BRAND,
  categoryId: CATEGORY,
  shortDescription: "",
  description: "",
  descriptionEn: "",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "DRAFT",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
};

function setup(permission: string, post?: () => unknown) {
  return installApi({
    permissions: [permission],
    get: (url) => {
      if (url === `/products/${PRODUCT}`) return beProduct;
      if (url === "/categories") {
        return page([
          {
            categoryId: CATEGORY,
            parentId: null,
            code: "C",
            name: "Ly giấy",
            slug: "ly",
            path: "/C",
            depth: 0,
            sortOrder: 0,
            active: true,
          },
        ]);
      }
      if (url === "/brands") {
        return page([
          { brandId: BRAND, code: "B", name: "Thương hiệu A", slug: "a", active: true },
        ]);
      }
      if (url === "/attributes") return page([]);
      if (url === `/categories/${CATEGORY}/attributes`) return [];
      return undefined;
    },
    post: (url) => (url === "/products" ? (post?.() ?? beProduct) : undefined),
  });
}

async function fillMaster(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/Mã sản phẩm/), "tote");
  await user.type(screen.getByLabelText(/^Tên sản phẩm/), "Túi tote");
  await user.type(screen.getByLabelText(/Tên tiếng Anh/), "Tote bag");
  await pickOption(user, /Thương hiệu/, "Thương hiệu A");
  await pickOption(user, /Danh mục/, "Ly giấy");
}

const stepButton = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => pushMock.mockClear());
afterEach(() => vi.restoreAllMocks());

// Luồng wizard nhiều bước (Radix Select + chuyển bước) chậm khi cả bộ test chạy song song → 15 s
// như PurchaseOrderCreate.test.
describe("ProductCreate — wizard nhiều bước", { timeout: 15_000 }, () => {
  it("tạo: bốn bước, ô bắt buộc trống thì không qua được bước Thông tin chung", async () => {
    setup(PRODUCT_PERMISSIONS.create);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);

    await user.click(await screen.findByRole("button", { name: "Tiếp tục" }));

    expect(await screen.findByText("Cần xử lý trước khi tiếp tục")).toBeInTheDocument();
    expect(stepButton(/Thông tin chung/)).toHaveAttribute("aria-current", "step");
    // Không nhảy cóc: bước sau bị khoá tới khi bước trước hợp lệ
    expect(stepButton(/Mô tả/)).toBeDisabled();
    expect(stepButton(/Trục biến thể/)).toBeDisabled();
    expect(stepButton(/Rà soát & tạo/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Tạo bản nháp" })).toBeNull();
  });

  it("tạo: bước rà soát tóm tắt thông tin đã nhập và báo một biến thể mặc định", async () => {
    setup(PRODUCT_PERMISSIONS.create);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await goToLastStep(user);

    expect(screen.getByRole("heading", { name: "Rà soát trước khi tạo" })).toBeInTheDocument();
    // Mã gõ thường vẫn hiện viết hoa như BE lưu
    expect(screen.getByText("TOTE", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Thương hiệu A", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Ly giấy", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(/1 biến thể mặc định/)).toBeInTheDocument();
  });

  it("tạo: BE báo mã đã tồn tại → quay về bước Thông tin chung, lỗi nằm ở ô mã", async () => {
    setup(PRODUCT_PERMISSIONS.create, () => {
      throw new ApiError(409, "PRODUCT_CODE_ALREADY_EXISTS", "Product code exists");
    });
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));

    await waitFor(() =>
      expect(stepButton(/Thông tin chung/)).toHaveAttribute("aria-current", "step"),
    );
    expect(screen.getAllByText("Mã sản phẩm đã tồn tại.").length).toBeGreaterThan(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("sửa: ba bước, không có bước trục, đi thẳng tới Rà soát & lưu", async () => {
    setup(PRODUCT_PERMISSIONS.update);
    const user = userEvent.setup();
    renderApp(<ProductCreate productId={PRODUCT} />);
    await screen.findByDisplayValue("Túi tote");

    expect(screen.queryByRole("button", { name: /Trục biến thể/ })).toBeNull();
    await user.click(stepButton(/Rà soát & lưu/));

    expect(screen.getByRole("heading", { name: "Rà soát trước khi lưu" })).toBeInTheDocument();
    expect(screen.getByText(/sửa ở trang chi tiết sản phẩm/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
  });
});
