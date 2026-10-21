import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, pickOption, renderApp } from "../product-test-utils";
import { AttributeDictionary } from "./AttributeDictionary";

const ALL = Object.values(ATTRIBUTE_PERMISSIONS);
const READ_ONLY = [ATTRIBUTE_PERMISSIONS.viewPage, ATTRIBUTE_PERMISSIONS.read];

const value = (code: string, over: Record<string, unknown> = {}) => ({
  valueId: `v-${code}`,
  code,
  label: `Nhãn ${code}`,
  valueNumber: null,
  hexColor: null,
  sortOrder: 0,
  active: true,
  version: 3,
  ...over,
});
const color = {
  attributeId: "a-color",
  code: "COLOR",
  name: "Màu sắc",
  dataType: "COLOR",
  unit: null,
  filterable: true,
  searchable: false,
  sortOrder: 0,
  active: true,
  version: 5,
  values: [
    value("WHT", { hexColor: "#FFFFFF" }),
    value("OLD", { hexColor: "#111111", active: false }),
  ],
};
const weight = {
  ...color,
  attributeId: "a-weight",
  code: "WEIGHT",
  name: "Khối lượng",
  dataType: "NUMBER",
  unit: "kg",
  version: 1,
  values: [],
};
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

function setup(
  permissions: readonly string[],
  over: { post?: (u: string, b: unknown) => unknown; del?: (u: string) => unknown } = {},
) {
  return installApi({
    permissions,
    get: (url, config) => {
      if (url === "/attributes") {
        const params = (config as { params?: URLSearchParams } | undefined)?.params;
        const type = params?.get("dataType");
        return page([color, weight].filter((a) => !type || a.dataType === type));
      }
      if (url === "/categories") {
        return page([
          {
            categoryId: "cat-1",
            parentId: null,
            code: "C1",
            name: "Ly giấy",
            slug: "ly",
            path: "/C1",
            depth: 0,
            sortOrder: 0,
            active: true,
          },
        ]);
      }
      if (url === "/categories/cat-1/attributes") return [];
      return undefined;
    },
    post: (url, body) => over.post?.(url, body),
    delete: (url) => over.del?.(url),
  });
}

describe("AttributeDictionary — danh sách + lọc", () => {
  it("liệt kê thuộc tính với loại và số giá trị bằng tiếng Việt; chỉ đọc thì không có nút Thêm", async () => {
    setup(READ_ONLY);
    renderApp(<AttributeDictionary />);
    expect(await screen.findByText("COLOR")).toBeInTheDocument();
    const row = screen.getByText("COLOR").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("Màu sắc");
    expect(row).toHaveTextContent("Đang dùng");
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Khối lượng").closest("tr")).toHaveTextContent("Số");
    expect(screen.queryByRole("button", { name: /Thêm thuộc tính/ })).not.toBeInTheDocument();
  });

  it("lọc theo loại gửi dataType lên BE (lọc phía server), kèm size tối đa", async () => {
    const { get } = setup(READ_ONLY);
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await screen.findByText("COLOR");
    await user.click(screen.getByRole("button", { name: "Lọc thuộc tính" }));
    await user.click(await screen.findByRole("option", { name: "Màu sắc" }));
    await waitFor(() => expect(screen.queryByText("WEIGHT")).not.toBeInTheDocument());
    const lastParams = get.mock.calls.filter((c) => c[0] === "/attributes").at(-1)?.[1] as {
      params: URLSearchParams;
    };
    expect(lastParams.params.get("dataType")).toBe("COLOR");
    expect(lastParams.params.get("size")).toBe("200");
  });

  it("lỗi tải khác danh sách trống: báo lỗi tiếng Việt và cho thử lại", async () => {
    installApi({
      permissions: READ_ONLY,
      get: (url) => {
        if (url === "/attributes") throw new ApiError(500, "INTERNAL", "boom");
        return undefined;
      },
    });
    renderApp(<AttributeDictionary />);
    expect(await screen.findByText("Không tải được từ điển thuộc tính")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("chưa có thuộc tính: trạng thái trống có hướng dẫn; bộ lọc không khớp: trạng thái khác kèm nút Bỏ bộ lọc", async () => {
    installApi({
      permissions: READ_ONLY,
      get: (url) => (url === "/attributes" ? page([]) : undefined),
    });
    renderApp(<AttributeDictionary />);
    expect(await screen.findByText("Chưa có thuộc tính nào")).toBeInTheDocument();
  });
});

describe("AttributeDictionary — tạo, sửa, giá trị, xoá", () => {
  it("Thêm thuộc tính gửi CreateAttributeRequest (mã giữ nguyên để BE viết hoa, loại, tên, thứ tự)", async () => {
    const { post } = setup(ALL, {
      post: () => ({ ...weight, attributeId: "new", code: "NEW", name: "Mới" }),
    });
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByRole("button", { name: /Thêm thuộc tính/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm thuộc tính" });
    expect(within(dialog).getByRole("button", { name: "Thêm thuộc tính" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Mã/), "new_attr");
    await user.type(within(dialog).getByLabelText(/^Tên/), "Mới");
    await user.type(within(dialog).getByLabelText("Thứ tự"), "4");
    await user.click(within(dialog).getByRole("button", { name: "Thêm thuộc tính" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/attributes", {
        code: "new_attr",
        dataType: "SELECT",
        name: "Mới",
        unit: undefined,
        filterable: true,
        searchable: false,
        sortOrder: 4,
      }),
    );
  });

  it("mã thuộc tính sai mẫu bị chặn ngay trong form", async () => {
    setup(ALL);
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByRole("button", { name: /Thêm thuộc tính/ }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm thuộc tính" });
    await user.type(within(dialog).getByLabelText(/^Mã/), "bad-code");
    expect(within(dialog).getByText(/Mã chỉ gồm chữ, số và '_'/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Thêm thuộc tính" })).toBeDisabled();
  });

  it("panel chi tiết: giá trị màu hiện kèm màu, giá trị ngừng dùng được đánh dấu; thêm giá trị màu gửi #RRGGBB viết hoa", async () => {
    const { post } = setup(ALL, { post: () => color });
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByText("COLOR"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Giá trị (2)")).toBeInTheDocument();
    expect(within(panel).getByText("Ngừng dùng", { selector: "span.text-xs" })).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: /Thêm giá trị/ }));
    const form = await screen.findByRole("dialog", { name: "Thêm giá trị cho Màu sắc" });
    await user.type(within(form).getByLabelText(/^Mã/), "red");
    await user.type(within(form).getByLabelText(/^Nhãn/), "Đỏ");
    const hex = within(form).getByLabelText(/^Màu \*/);
    await user.clear(hex);
    await user.type(hex, "#ff0000");
    await user.click(within(form).getByRole("button", { name: "Thêm giá trị" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/attributes/a-color/values", {
        code: "red",
        label: "Đỏ",
        valueNumber: null,
        hexColor: "#FF0000",
        sortOrder: undefined,
      }),
    );
  });

  it("thuộc tính không có danh sách giá trị (NUMBER) không có phần giá trị", async () => {
    setup(ALL);
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByText("WEIGHT"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).queryByText(/Giá trị \(/)).not.toBeInTheDocument();
    expect(within(panel).getByText(/nhập giá trị trực tiếp trên sản phẩm/)).toBeInTheDocument();
  });

  it("xoá thuộc tính gửi version của lần đọc; đang được dùng (ATTRIBUTE_IN_USE) → báo trong hộp thoại, không đóng panel", async () => {
    const { del } = setup(ALL, {
      del: () => {
        throw new ApiError(409, "ATTRIBUTE_IN_USE", "in use");
      },
    });
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByText("COLOR"));
    const panel = await screen.findByRole("dialog");
    await user.click(within(panel).getByRole("button", { name: /^Xoá$/ }));
    const confirm = await screen.findByRole("dialog", { name: "Xoá thuộc tính?" });
    await user.click(within(confirm).getByRole("button", { name: "Xoá" }));
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith("/attributes/a-color", { params: { version: 5 } }),
    );
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      /Đang được sản phẩm hoặc danh mục sử dụng/,
    );
  });

  it("xoá một giá trị gửi version của GIÁ TRỊ", async () => {
    const { del } = setup(ALL, { del: () => ({ ...color, values: [color.values[1]] }) });
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByText("COLOR"));
    const panel = await screen.findByRole("dialog");
    await user.click(within(panel).getByRole("button", { name: "Xoá giá trị WHT" }));
    const confirm = await screen.findByRole("dialog", { name: "Xoá giá trị?" });
    await user.click(within(confirm).getByRole("button", { name: "Xoá" }));
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith("/attributes/a-color/values/v-WHT", {
        params: { version: 3 },
      }),
    );
  });

  it("chỉ đọc: panel không có Sửa / Xoá / Thêm giá trị", async () => {
    setup(READ_ONLY);
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />);
    await user.click(await screen.findByText("COLOR"));
    const panel = await screen.findByRole("dialog");
    expect(
      within(panel).queryByRole("button", { name: /Sửa|Xoá|Thêm giá trị/ }),
    ).not.toBeInTheDocument();
  });
});

describe("AttributeDictionary — bộ thuộc tính theo danh mục", () => {
  it("tab Theo danh mục: chọn danh mục, thêm thuộc tính (SELECT / COLOR mặc định là trục) và lưu cả bộ", async () => {
    const put = vi.fn(() => []);
    const base = setup(ALL);
    const { api } = await import("@/lib/api/client");
    vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => ({
      data: (put as (u: string, b: unknown) => unknown)(url, body),
    }));
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />, { searchParams: "?tab=categories" });
    await pickOption(user, "Danh mục", "Ly giấy");
    expect(await screen.findByText("Danh mục này chưa có thuộc tính gợi ý.")).toBeInTheDocument();
    await pickOption(user, "Thêm thuộc tính cho danh mục", /COLOR\)/);
    await user.click(screen.getByRole("button", { name: "Lưu bộ thuộc tính" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/categories/cat-1/attributes", {
        attributes: [
          { attributeId: "a-color", defaultRole: "VARIANT_AXIS", required: false, sortOrder: 0 },
        ],
      }),
    );
    expect(base.get).toHaveBeenCalled();
  });

  it("thuộc tính loại số chỉ được đặt vai trò Mô tả (không chọn được Trục biến thể)", async () => {
    setup(ALL);
    const user = userEvent.setup();
    renderApp(<AttributeDictionary />, { searchParams: "?tab=categories" });
    await pickOption(user, "Danh mục", "Ly giấy");
    await pickOption(user, "Thêm thuộc tính cho danh mục", /WEIGHT\)/);
    const role = await screen.findByRole("combobox", { name: /Vai trò của Khối lượng/ });
    expect(role).toHaveTextContent("Mô tả");
    await user.click(role);
    expect(await screen.findByRole("option", { name: "Trục biến thể" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
