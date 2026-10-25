/**
 * Tạo sản phẩm kèm trục (BE PR #116): form thật + hook thật, chỉ giả `api` — kiểm request `POST
 * /products` mang đúng `axes`, bản xem trước SKU, chặn trước khi gọi BE và lỗi giao dịch bị từ chối.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  goToLastStep,
  installApi,
  nextStep,
  pickOption,
  pickTreeOption,
  renderApp,
} from "../product-test-utils";
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

function setup(dictionary: unknown[], post?: () => unknown, categoryAttributes?: unknown[]) {
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
      // Bộ thuộc tính gợi ý của danh mục (BE `CategoryAttributeController`); không truyền = lỗi
      if (url === `/categories/${CATEGORY}/attributes`) return categoryAttributes;
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
  await pickTreeOption(user, /Danh mục/, "Ly giấy");
}

/** Thông tin chung → Mô tả → Trục biến thể. */
const toAxesStep = (user: ReturnType<typeof userEvent.setup>) => nextStep(user, 2);

async function addAxis(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  attributeName: string,
) {
  await user.click(await screen.findByRole("button", { name: /Thêm trục/ }));
  await pickOption(user, `Thuộc tính của trục ${index}`, new RegExp(attributeName));
}

// Luồng wizard nhiều bước (Radix Select + chuyển bước) chậm khi cả bộ test chạy song song → 15 s
// như PurchaseOrderCreate.test.
describe("ProductCreate — trục biến thể khi tạo sản phẩm", { timeout: 15_000 }, () => {
  it("không chọn trục: POST không có `axes` (BE tạo một biến thể mặc định)", async () => {
    const { post } = setup([attribute("a-size", "SIZE", ["S", "M"])]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await goToLastStep(user);
    expect(screen.getByText(/Không có trục — tạo một biến thể mặc định/)).toBeInTheDocument();
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
    await toAxesStep(user);

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

    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    // 4 SKU → xác nhận trước khi tạo cả ma trận
    const confirm = await screen.findByRole("dialog", { name: "Tạo sản phẩm và 4 SKU?" });
    expect(post).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Tạo sản phẩm" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect((post.mock.calls[0]?.[1] as { axes: unknown }).axes).toEqual([
      { attributeId: "a-size", sortOrder: 0, optionValueIds: ["v-S", "v-M"] },
      { attributeId: "a-color", sortOrder: 1, optionValueIds: ["v-BLK", "v-WHT"] },
    ]);
  }, 15_000);

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
    await toAxesStep(user);
    await addAxis(user, 1, "BIG");
    for (const code of codes("B", 11)) await user.click(screen.getByLabelText(`Nhãn ${code}`));
    await addAxis(user, 2, "TEN");
    for (const code of codes("T", 10)) await user.click(screen.getByLabelText(`Nhãn ${code}`));

    expect(await screen.findByText(/Ma trận có 110 biến thể — tối đa 100/)).toBeInTheDocument();
    // Ma trận lỗi → "Tiếp tục" không qua được bước trục, không tới được nút tạo
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText("Cần xử lý trước khi tiếp tục")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trục biến thể/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.queryByRole("button", { name: "Tạo bản nháp" })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  }, 15_000);

  it("trục chưa chọn giá trị: chặn và báo ở bản nháp trục", async () => {
    const { post } = setup([attribute("a-size", "SIZE", ["S"])]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await toAxesStep(user);
    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
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
    await toAxesStep(user);
    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByLabelText("Nhãn S"));
    await goToLastStep(user);
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
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await toAxesStep(user);
    const section = (await screen.findByText("Trục biến thể (tuỳ chọn)")).closest(
      "section",
    ) as HTMLElement;
    expect(await within(section).findByRole("alert")).toHaveTextContent(
      /Không tải được từ điển thuộc tính/,
    );
  });
});

const suggestion = (attributeId: string, name: string, required: boolean, sortOrder: number) => ({
  attributeId,
  attributeCode: attributeId.toUpperCase(),
  attributeName: name,
  dataType: "SELECT",
  attributeActive: true,
  defaultRole: "VARIANT_AXIS",
  required,
  sortOrder,
});

// Luồng nhiều bước (Radix Select + dialog) chậm khi cả bộ test chạy song song → 15 s như
// PurchaseOrderCreate.test.
describe("ProductCreate — trục gợi ý của danh mục (spec D9) và xác nhận số SKU", () => {
  const dictionary = [
    attribute("a-size", "SIZE", ["S", "M"]),
    attribute("a-color", "COLOR", ["WHT", "BLK"]),
  ];

  it("danh mục có trục bắt buộc: điền sẵn trục, nút thêm nhanh trục gợi ý còn lại", async () => {
    setup(dictionary, undefined, [
      suggestion("a-color", "Màu", false, 1),
      suggestion("a-size", "Cỡ", true, 0),
      { ...suggestion("a-note", "Ghi chú", false, 2), defaultRole: "DESCRIPTIVE" },
    ]);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await toAxesStep(user);

    expect(
      await screen.findByRole("combobox", { name: "Thuộc tính của trục 1" }),
    ).toHaveTextContent("Thuộc tính SIZE (SIZE)");
    expect(screen.getByText(/Danh mục gợi ý trục bắt buộc: Cỡ/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ghi chú/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Màu/ }));
    expect(screen.getByRole("combobox", { name: "Thuộc tính của trục 2" })).toHaveTextContent(
      "Thuộc tính COLOR (COLOR)",
    );
    expect(screen.queryByRole("button", { name: /Màu/ })).toBeNull();
  }, 15_000);

  it("danh mục không có gợi ý: form như cũ — không điền trục, không nút thêm nhanh", async () => {
    const { get } = setup(dictionary, undefined, []);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await toAxesStep(user);
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(`/categories/${CATEGORY}/attributes`, expect.anything()),
    );
    expect(screen.getByText(/Chưa có trục nào/)).toBeInTheDocument();
    expect(screen.queryByText(/Trục gợi ý của danh mục/)).toBeNull();
  }, 15_000);

  it("nhiều SKU: Huỷ ở hộp xác nhận thì không tạo; một SKU thì tạo luôn không hỏi", async () => {
    const { post } = setup(dictionary, undefined, []);
    const user = userEvent.setup();
    renderApp(<ProductCreate />);
    await fillMaster(user);
    await toAxesStep(user);
    await addAxis(user, 1, "SIZE");
    await user.click(screen.getByLabelText("Nhãn S"));
    await user.click(screen.getByLabelText("Nhãn M"));
    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    const confirm = await screen.findByRole("dialog", { name: "Tạo sản phẩm và 2 SKU?" });
    await user.click(within(confirm).getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(post).not.toHaveBeenCalled();

    // Quay lại bước trục (thanh dưới), bỏ bớt giá trị → còn một SKU
    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await user.click(screen.getByLabelText("Nhãn M"));
    await goToLastStep(user);
    await user.click(screen.getByRole("button", { name: "Tạo bản nháp" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  }, 15_000);
});
