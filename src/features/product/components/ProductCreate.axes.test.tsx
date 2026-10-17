/**
 * Tạo sản phẩm kèm trục (BE PR #116): form thật + hook thật, chỉ giả `api` — kiểm request `POST
 * /products` mang đúng `axes`, bản xem trước SKU, chặn trước khi gọi BE và lỗi giao dịch bị từ chối.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, pickOption, renderApp } from "../product-test-utils";
import { ProductCreate } from "./ProductCreate";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));

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
const value = (code: string, sortOrder: number) => ({
  valueId: `v-${code}`,
  code,
  label: `Nhãn ${code}`,
  valueNumber: null,
  hexColor: null,
  sortOrder,
  active: true,
  version: 0,
});
const attribute = (attributeId: string, code: string, codes: string[]) => ({
  attributeId,
  code,
  name: `Thuộc tính ${code}`,
  dataType: "SELECT",
  unit: null,
  filterable: true,
  searchable: false,
  sortOrder: 0,
  active: true,
  version: 0,
  values: codes.map(value.bind(null)).map((v, i) => ({ ...v, sortOrder: i })),
});
const created = {
  productId: "11111111-1111-4111-8111-111111111111",
  code: "CUP",
  name: "Ly",
  nameEn: "Cup",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "DRAFT",
  version: 0,
  createdAt: "2026-01-01T00:00:00Z",
};

function setup(dictionary: unknown[], post?: () => unknown) {
  return installApi({
    permissions: [PRODUCT_PERMISSIONS.create],
    get: (url) => {
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
      if (url === "/brands")
        return page([
          { brandId: BRAND, code: "B", name: "Thương hiệu A", slug: "a", active: true },
        ]);
      if (url === "/attributes") return page(dictionary);
      return undefined;
    },
    post: (url) => (url === "/products" ? (post ? post() : created) : undefined),
  });
}

beforeEach(() => pushMock.mockClear());
afterEach(() => vi.restoreAllMocks());

async function fillMaster(user: ReturnType<typeof userEvent.setup>, code = "cup") {
  await user.type(await screen.findByLabelText(/Mã sản phẩm/), code);
  await user.type(screen.getByLabelText(/^Tên sản phẩm/), "Ly");
  await user.type(screen.getByLabelText(/Tên tiếng Anh/), "Cup");
  await pickOption(user, /Thương hiệu/, "Thương hiệu A");
  await pickOption(user, /Danh mục/, "Ly giấy");
}

async function addAxis(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  attributeName: string,
) {
  await user.click(await screen.findByRole("button", { name: /Thêm trục/ }));
  await pickOption(user, `Thuộc tính của trục ${index}`, new RegExp(attributeName));
}

describe("ProductCreate — trục biến thể khi tạo sản phẩm", () => {
  it("không chọn trục: POST không có `axes` (BE tạo một biến thể mặc định)", async () => {
    const { post } = setup([attribute("a-size", "SIZE", ["S", "M"])]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("axes");
    expect(body).toMatchObject({ code: "cup", kind: "STANDARD" });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/admin/products/${created.productId}`),
    );
  });

  it("chọn hai trục: xem trước số biến thể + SKU theo quy tắc, rồi POST kèm `axes` theo thứ tự trục", async () => {
    const { post } = setup([
      attribute("a-size", "SIZE", ["S", "M"]),
      attribute("a-color", "COLOR", ["WHT", "BLK"]),
    ]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user, "cup");

    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByLabelText("Nhãn S"));
    await user.click(screen.getByLabelText("Nhãn M"));
    await addAxis(user, 2, "COLOR");
    await user.click(screen.getByLabelText("Nhãn BLK"));
    await user.click(screen.getByLabelText("Nhãn WHT"));

    expect(await screen.findByText(/Sẽ tạo/)).toHaveTextContent("Sẽ tạo 4 biến thể (Nháp)");
    // Mã sản phẩm viết hoa, giá trị theo thứ tự từ điển (không phải thứ tự bấm), trục theo thứ tự đã chọn.
    expect(screen.getByText("CUP-S-WHT")).toBeInTheDocument();
    expect(screen.getByText("CUP-M-BLK")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect((post.mock.calls[0]?.[1] as { axes: unknown }).axes).toEqual([
      { attributeId: "a-size", sortOrder: 0, optionValueIds: ["v-S", "v-M"] },
      { attributeId: "a-color", sortOrder: 1, optionValueIds: ["v-BLK", "v-WHT"] },
    ]);
  });

  it("quá 100 tổ hợp: chặn trước khi gọi BE và nói rõ số tổ hợp", async () => {
    const codes = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    const { post } = setup([
      attribute("a-big", "BIG", codes("B", 11)),
      attribute("a-ten", "TEN", codes("T", 10)),
    ]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await addAxis(user, 1, "BIG");
    for (const code of codes("B", 11)) await user.click(screen.getByLabelText(`Nhãn ${code}`));
    await addAxis(user, 2, "TEN");
    for (const code of codes("T", 10)) await user.click(screen.getByLabelText(`Nhãn ${code}`));

    expect(await screen.findByText(/Ma trận có 110 biến thể — tối đa 100/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    expect(await screen.findAllByText(/Ma trận có 110 biến thể/)).not.toHaveLength(0);
    expect(post).not.toHaveBeenCalled();
  });

  it("trục chưa chọn giá trị: chặn và báo ở bản nháp trục", async () => {
    const { post } = setup([attribute("a-size", "SIZE", ["S"])]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => /Trục 1: chọn ít nhất một giá trị/.test(a.textContent ?? ""))).toBe(
      true,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("BE từ chối cả giao dịch (SKU trùng): hiện lý do bằng tiếng Việt, nói rõ sản phẩm chưa được tạo, không điều hướng", async () => {
    setup([attribute("a-size", "SIZE", ["S"])], () => {
      throw new ApiError(409, "VARIANT_SKU_ALREADY_EXISTS", "SKU CUP-S is taken");
    });
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByLabelText("Nhãn S"));
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    const alert = await screen.findByText(/Sản phẩm chưa được tạo/);
    expect(alert).toHaveTextContent(/trùng/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("không tải được từ điển thuộc tính: vẫn tạo được sản phẩm không kèm trục", async () => {
    installApi({
      permissions: [PRODUCT_PERMISSIONS.create],
      get: (url) => {
        if (url === "/attributes") throw new ApiError(403, "FORBIDDEN", "no");
        if (url === "/categories")
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
        if (url === "/brands")
          return page([
            { brandId: BRAND, code: "B", name: "Thương hiệu A", slug: "a", active: true },
          ]);
        return undefined;
      },
    });
    renderApp(<ProductCreate />);
    const section = (await screen.findByText("Trục biến thể (tuỳ chọn)")).closest(
      "section",
    ) as HTMLElement;
    expect(await within(section).findByRole("alert")).toHaveTextContent(
      /Không tải được từ điển thuộc tính/,
    );
  });
});
