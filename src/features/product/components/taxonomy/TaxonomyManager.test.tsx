import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { installApi, pickOption, renderApp } from "../../product-test-utils";
import { TaxonomyManager } from "./TaxonomyManager";

afterEach(() => vi.restoreAllMocks());

const P = PRODUCT_PERMISSIONS;
/** Seed BE product-products: ECOMMERCE_ADMIN đủ quyền; SALES_STAFF sửa được; còn lại chỉ xem. */
const PRODUCT_ROLES = {
  ecommerceAdmin: Object.values(P),
  salesStaff: [P.viewPage, P.read, P.create, P.update],
  readOnly: [P.viewPage, P.read],
} satisfies Record<string, readonly string[]>;

type Routes = Record<string, () => unknown>;
const byUrl = (routes: Routes | undefined) => (url: string) => routes?.[url]?.();

const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: Math.max(items.length, 1),
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
});

const gildan = {
  brandId: "b-gildan",
  code: "GILDAN",
  name: "Gildan",
  slug: "gildan",
  active: true,
  version: 2,
};
const apparel = {
  categoryId: "c-apparel",
  code: "APPAREL",
  name: "Thời trang",
  slug: "apparel",
  path: "/APPAREL",
  depth: 0,
  sortOrder: 0,
  active: true,
  version: 0,
};
const tshirt = {
  ...apparel,
  categoryId: "c-tshirt",
  parentId: "c-apparel",
  code: "TSHIRT",
  name: "Áo thun",
  slug: "tshirt",
  path: "/APPAREL/TSHIRT",
  depth: 1,
  sortOrder: 5,
};

function setup(
  permissions: readonly string[],
  searchParams = "",
  routes: { brands?: unknown[]; categories?: unknown[]; post?: Routes; put?: Routes } = {},
) {
  const api = installApi({
    permissions,
    get: byUrl({
      "/brands": () => page(routes.brands ?? [gildan]),
      "/categories": () => page(routes.categories ?? [apparel, tshirt]),
    }),
    post: byUrl(routes.post),
    put: byUrl(routes.put),
  });
  renderApp(<TaxonomyManager />, { searchParams });
  return api;
}

describe("TaxonomyManager — tab Thương hiệu (gate product-products, ProductTaxonomyController)", () => {
  it("ECOMMERCE_ADMIN: tạo thương hiệu gửi mã đã chuẩn hoá", async () => {
    const user = userEvent.setup();
    const { post } = setup(PRODUCT_ROLES.ecommerceAdmin, "", {
      post: { "/brands": () => ({ ...gildan, brandId: "b-new", code: "HANES", name: "Hanes" }) },
    });
    await user.click(await screen.findByRole("button", { name: /Tạo thương hiệu/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Mã/), " hanes ");
    await user.type(within(dialog).getByLabelText(/Tên/), "Hanes");
    await user.click(within(dialog).getByRole("button", { name: "Tạo thương hiệu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/brands", {
        code: "HANES",
        name: "Hanes",
        logoUrl: undefined,
      }),
    );
  });

  it("trùng mã / slug (409) → báo ngay dưới ô mã, dialog giữ nguyên", async () => {
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.ecommerceAdmin, "", {
      post: {
        "/brands": () => {
          throw new ApiError(409, "BRAND_CODE_ALREADY_EXISTS", "Brand GILDAN exists");
        },
      },
    });
    await user.click(await screen.findByRole("button", { name: /Tạo thương hiệu/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Mã/), "gildan");
    await user.type(within(dialog).getByLabelText(/Tên/), "Gildan 2");
    await user.click(within(dialog).getByRole("button", { name: "Tạo thương hiệu" }));
    expect(await within(dialog).findByText(/Mã đã được dùng/)).toBeInTheDocument();
  });

  it("SALES_STAFF (product-products UPDATE): sửa gửi đủ field, ngưng dùng = active false", async () => {
    const user = userEvent.setup();
    const { put } = setup(PRODUCT_ROLES.salesStaff, "", {
      put: { "/brands/b-gildan": () => ({ ...gildan, active: false }) },
    });
    await user.click(await screen.findByText("GILDAN"));
    const dialog = await screen.findByRole("dialog", { name: /Sửa thương hiệu GILDAN/ });
    expect(within(dialog).getByLabelText(/Mã/)).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "Đang dùng" }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/brands/b-gildan", {
        name: "Gildan",
        logoUrl: undefined,
        active: false,
      }),
    );
  });

  it("sửa bị người khác ghi trước (OPTIMISTIC_LOCK) → đóng dialog, toast, tải lại danh sách", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => undefined);
    const { get } = setup(PRODUCT_ROLES.ecommerceAdmin, "", {
      put: {
        "/brands/b-gildan": () => {
          throw new ApiError(409, "OPTIMISTIC_LOCK", "changed meanwhile");
        },
      },
    });
    await user.click(await screen.findByText("GILDAN"));
    const dialog = await screen.findByRole("dialog");
    const brandCalls = () => get.mock.calls.filter(([url]) => url === "/brands").length;
    const before = brandCalls();
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    // Không để bấm Lưu lại trên dữ liệu cũ — PUT của BE không có version nên sẽ ghi đè
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Dữ liệu đã thay đổi",
      expect.stringMatching(/Danh sách đã được tải lại/),
    );
    await waitFor(() => expect(brandCalls()).toBeGreaterThan(before));
  });

  it("chỉ READ: không có nút tạo, bấm dòng chỉ xem (ô khoá, không nút Lưu)", async () => {
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.readOnly);
    await user.click(await screen.findByText("GILDAN"));
    const dialog = await screen.findByRole("dialog", { name: /Thương hiệu GILDAN/ });
    expect(screen.queryByRole("button", { name: /Tạo thương hiệu/ })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Tên/)).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });

  it("thiếu product-products:READ: không gọi /brands, báo không có quyền xem", async () => {
    const { get } = setup(
      PRODUCT_ROLES.ecommerceAdmin.filter((p) => p !== PRODUCT_PERMISSIONS.read),
    );
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith("/brands", expect.anything());
  });

  it("chưa có dữ liệu và lọc không ra là hai EmptyState khác nhau", async () => {
    setup(PRODUCT_ROLES.readOnly, "", { brands: [] });
    expect(await screen.findByText("Chưa có thương hiệu")).toBeInTheDocument();
  });

  it("lọc không ra → nút bỏ bộ lọc; lọc trạng thái gửi active=false", async () => {
    const { get } = setup(PRODUCT_ROLES.readOnly, "?status=inactive", { brands: [] });
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ bộ lọc" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      "/brands",
      expect.objectContaining({ params: expect.objectContaining({ active: false }) }),
    );
  });
});

describe("TaxonomyManager — tab Danh mục", () => {
  it("cây kiểu Drive: mặc định chỉ thấy gốc, bấm mũi tên để hiện / ẩn danh mục con", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCT_ROLES.readOnly, "?tab=categories");
    await screen.findByText("APPAREL");
    expect(screen.queryByText("TSHIRT")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Mở danh mục con của Thời trang" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    // Bấm mũi tên không mở dialog sửa
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const row = (await screen.findByText("TSHIRT")).closest("tr");
    if (!row) throw new Error("row missing");
    expect(within(row).getByText("2")).toBeInTheDocument();
    // Không còn cột "Danh mục cha" — vị trí trong cây đã cho biết cha
    expect(screen.queryByRole("columnheader", { name: "Danh mục cha" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thu gọn danh mục con của Thời trang" }));
    expect(screen.queryByText("TSHIRT")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      "/categories",
      expect.objectContaining({ params: expect.objectContaining({ sort: "path,asc" }) }),
    );
  });

  it("tạo danh mục con: chọn cha trong danh sách thụt lề, gửi parentId", async () => {
    const user = userEvent.setup();
    const { post } = setup(PRODUCT_ROLES.ecommerceAdmin, "?tab=categories", {
      post: { "/categories": () => ({ ...tshirt, categoryId: "c-polo", code: "POLO" }) },
    });
    await user.click(await screen.findByRole("button", { name: /Tạo danh mục/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Mã/), "polo");
    await user.type(within(dialog).getByLabelText(/^Tên/), "Áo polo");
    await pickOption(user, /Danh mục cha/, /Thời trang/);
    await user.click(within(dialog).getByRole("button", { name: "Tạo danh mục" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/categories",
        expect.objectContaining({ code: "POLO", parentId: "c-apparel", name: "Áo polo" }),
      ),
    );
  });

  it("mở dialog tạo sau khi cây đã tải: dùng chung cache, không gọi /categories lần nữa", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCT_ROLES.ecommerceAdmin, "?tab=categories");
    await screen.findByText("APPAREL");
    const before = get.mock.calls.filter(([url]) => url === "/categories").length;
    await user.click(screen.getByRole("button", { name: /Tạo danh mục/ }));
    await screen.findByRole("dialog");
    await pickOption(user, /Danh mục cha/, /Thời trang/);
    expect(get.mock.calls.filter(([url]) => url === "/categories")).toHaveLength(before);
  });

  it("danh mục đã ngưng không được chọn làm cha", async () => {
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.ecommerceAdmin, "?tab=categories", {
      categories: [apparel, { ...tshirt, active: false }],
    });
    await screen.findByText("APPAREL");
    await user.click(screen.getByRole("button", { name: /Tạo danh mục/ }));
    await screen.findByRole("dialog");
    await user.click(await screen.findByRole("combobox", { name: /Danh mục cha/ }));
    expect(await screen.findByRole("option", { name: /Thời trang/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Áo thun/ })).not.toBeInTheDocument();
  });

  it("sửa danh mục: mã và cha khoá, PUT không gửi mã / cha", async () => {
    const user = userEvent.setup();
    const { put } = setup(PRODUCT_ROLES.ecommerceAdmin, "?tab=categories", {
      put: { "/categories/c-tshirt": () => tshirt },
    });
    await user.click(await screen.findByRole("button", { name: "Mở tất cả" }));
    await user.click(await screen.findByText("TSHIRT"));
    const dialog = await screen.findByRole("dialog", { name: /Sửa danh mục TSHIRT/ });
    expect(within(dialog).getByLabelText(/Danh mục cha/)).toHaveValue("APPAREL");
    expect(within(dialog).getByLabelText(/Danh mục cha/)).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [, body] = put.mock.calls[0] ?? [];
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("parentId");
    expect(body).toMatchObject({ name: "Áo thun", sortOrder: 5, active: true });
  });

  it("thứ tự cây: mã trùng tiền tố có '-' không chen giữa cha và con", async () => {
    const ao = { ...apparel, categoryId: "c-ao", code: "AO", name: "Áo", path: "/AO" };
    const aoKhoac = {
      ...ao,
      categoryId: "c-aok",
      code: "AO-KHOAC",
      name: "Áo khoác",
      path: "/AO-KHOAC",
    };
    const thun = {
      ...tshirt,
      categoryId: "c-thun",
      parentId: "c-ao",
      code: "THUN",
      name: "Áo thun",
      path: "/AO/THUN",
    };
    // BE sắp `path` theo cả chuỗi: '-' < '/' nên AO-KHOAC đứng trước con của AO
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.readOnly, "?tab=categories", { categories: [ao, aoKhoac, thun] });
    await user.click(await screen.findByRole("button", { name: "Mở tất cả" }));
    await screen.findByText("THUN");
    const codes = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
    expect(codes).toEqual(["AO", "THUN", "AO-KHOAC"]);
  });

  it("con không bị tách khỏi cha sang trang khác dù BE xếp nó cuối danh sách", async () => {
    const ao = { ...apparel, categoryId: "c-ao", code: "AO", name: "Áo", path: "/AO" };
    // 15 gốc "AO-01" … "AO-15": theo thứ tự chuỗi của BE chúng đứng trước "/AO/THUN"
    const siblings = Array.from({ length: 15 }, (_, i) => {
      const code = `AO-${String(i + 1).padStart(2, "0")}`;
      return { ...ao, categoryId: `c-${code}`, code, name: code, path: `/${code}` };
    });
    const thun = {
      ...tshirt,
      categoryId: "c-thun",
      parentId: "c-ao",
      code: "THUN",
      path: "/AO/THUN",
    };
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.readOnly, "?tab=categories", { categories: [ao, ...siblings, thun] });
    await user.click(await screen.findByRole("button", { name: "Mở tất cả" }));
    await screen.findByText("THUN");
    const codes = screen
      .getAllByRole("row")
      .slice(1, 3)
      .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
    expect(codes).toEqual(["AO", "THUN"]);
  });

  it("ô chọn danh mục cha báo lỗi tải, không im lặng chỉ còn Danh mục gốc", async () => {
    const user = userEvent.setup();
    installApi({
      permissions: PRODUCT_ROLES.ecommerceAdmin,
      get: byUrl({
        "/brands": () => page([gildan]),
        "/categories": () => {
          throw new ApiError(500, "INTERNAL_ERROR", "boom");
        },
      }),
    });
    renderApp(<TaxonomyManager />, { searchParams: "?tab=categories" });
    await user.click(await screen.findByRole("button", { name: /Tạo danh mục/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/Không tải được danh sách danh mục/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("đang tìm kiếm: hiện phẳng, không thụt lề / ký hiệu nhánh cho dòng mất cha", async () => {
    setup(PRODUCT_ROLES.readOnly, "?tab=categories&q=thun", { categories: [tshirt] });
    const row = (await screen.findByText("TSHIRT")).closest("tr");
    if (!row) throw new Error("row missing");
    expect(within(row).queryByRole("button", { name: /danh mục con/ })).not.toBeInTheDocument();
  });

  it("gõ tìm kiếm: giữ dạng cây tới khi debounce xong, không bung phẳng cả danh mục con", async () => {
    const user = userEvent.setup();
    setup(PRODUCT_ROLES.readOnly, "?tab=categories");
    await screen.findByText("APPAREL");
    await user.type(screen.getByPlaceholderText("Tìm theo mã hoặc tên danh mục"), "a");
    // Chưa qua 300ms: query vẫn là bộ lọc cũ nên bảng phải giữ nguyên cây (con còn thu gọn)
    expect(screen.queryByText("TSHIRT")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mở danh mục con của Thời trang" }),
    ).toBeInTheDocument();
  });

  it("đổi tab bỏ tìm kiếm của tab cũ", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCT_ROLES.readOnly, "?q=gil");
    expect(await screen.findByText("GILDAN")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Danh mục" }));
    // Còn giữ "gil" thì bảng lọc phẳng và không ra dòng nào; đã bỏ thì thấy cây (gốc APPAREL)
    expect(await screen.findByText("APPAREL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm theo mã hoặc tên danh mục")).toHaveValue("");
    expect(get).toHaveBeenLastCalledWith(
      "/categories",
      expect.objectContaining({ params: expect.objectContaining({ q: undefined }) }),
    );
  });
});
