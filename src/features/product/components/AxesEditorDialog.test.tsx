import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installApi, renderApp } from "../product-test-utils";
import { AxesEditorDialog } from "./AxesEditorDialog";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

const value = (code: string, sortOrder: number, hexColor: string | null = null) => ({
  valueId: `v-${code}`,
  code,
  label: code,
  valueNumber: null,
  hexColor,
  sortOrder,
  active: true,
  version: 0,
});
const attribute = (
  attributeId: string,
  code: string,
  dataType: string,
  values: ReturnType<typeof value>[],
) => ({
  attributeId,
  code,
  name: code === "COLOR" ? "Màu sắc" : code === "SIZE" ? "Cỡ" : code,
  dataType,
  unit: null,
  filterable: true,
  searchable: false,
  sortOrder: 0,
  active: true,
  version: 0,
  values,
});
const dictionary = [
  attribute("a-color", "COLOR", "COLOR", [value("WHT", 0, "#FFFFFF"), value("BLK", 1, "#000000")]),
  attribute("a-size", "SIZE", "SELECT", [value("S", 0), value("M", 1)]),
  attribute("a-note", "NOTE", "TEXT", []),
];
const option = (code: string, used: boolean) => ({
  valueId: `v-${code}`,
  code,
  label: code,
  hexColor: null,
  valueNumber: null,
  active: true,
  usedByVariant: used,
});
const attributes = (used: boolean) => ({
  productId: PRODUCT,
  axes: [
    {
      attributeId: "a-color",
      code: "COLOR",
      name: "Màu sắc",
      dataType: "COLOR",
      sortOrder: 0,
      options: [option("WHT", used)],
    },
  ],
  descriptives: [],
});

afterEach(() => vi.restoreAllMocks());

function setup(used: boolean, items: unknown[] = dictionary) {
  return installApi({
    permissions: [],
    get: (url) => {
      if (url === `/products/${PRODUCT}/attributes`) return attributes(used);
      if (url === "/attributes") {
        return {
          items,
          page: 0,
          size: 200,
          totalElements: items.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
      }
      return undefined;
    },
    put: (url) => (url === `/products/${PRODUCT}/axes` ? attributes(used) : undefined),
  });
}

function renderDialog(isDraft: boolean) {
  return renderApp(
    <AxesEditorDialog productId={PRODUCT} isDraft={isDraft} open onOpenChange={vi.fn()} />,
  );
}

describe("AxesEditorDialog — PUT /products/{id}/axes", () => {
  it("Nháp: thêm trục mới, chọn giá trị và lưu cả danh sách (thứ tự = sortOrder, không gồm thuộc tính không làm trục được)", async () => {
    const { put } = setup(false);
    const user = userEvent.setup();
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    await within(dialog).findByRole("combobox", { name: "Thuộc tính của trục 1" });

    await user.click(within(dialog).getByRole("button", { name: /Thêm trục/ }));
    await user.click(within(dialog).getByRole("combobox", { name: "Thuộc tính của trục 2" }));
    // Chỉ SIZE: COLOR đã là trục 1, NOTE (TEXT) không làm trục được.
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Cỡ (SIZE)"]);
    await user.click(options[0] as HTMLElement);
    await user.click(within(dialog).getByLabelText("S"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu trục" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/axes`, {
        axes: [
          { attributeId: "a-color", sortOrder: 0, optionValueIds: ["v-WHT"] },
          { attributeId: "a-size", sortOrder: 1, optionValueIds: ["v-S"] },
        ],
      }),
    );
  });

  it("đã rời Nháp: không thêm / gỡ được trục, nhưng thêm giá trị cho trục đã có thì được", async () => {
    const { put } = setup(false);
    const user = userEvent.setup();
    renderDialog(false);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    await within(dialog).findByRole("combobox", { name: "Thuộc tính của trục 1" });
    expect(within(dialog).getByRole("button", { name: /Thêm trục/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Gỡ trục" })).toBeDisabled();
    await user.click(within(dialog).getByLabelText("BLK"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu trục" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/axes`, {
        axes: [{ attributeId: "a-color", sortOrder: 0, optionValueIds: ["v-WHT", "v-BLK"] }],
      }),
    );
  });

  it("giá trị đang được biến thể dùng không bỏ chọn được; có biến thể mang tuỳ chọn thì không thêm trục mới", async () => {
    setup(true);
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    const used = await within(dialog).findByLabelText("WHT");
    expect(used).toBeChecked();
    expect(used).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Gỡ trục" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Thêm trục/ })).toBeDisabled();
  });

  it("trục không có giá trị nào → không lưu được và báo lý do", async () => {
    setup(false);
    const user = userEvent.setup();
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    await user.click(await within(dialog).findByLabelText("WHT"));
    expect(within(dialog).getByRole("button", { name: "Lưu trục" })).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/ít nhất một giá trị/);
  });

  it("lỗi BE hiện bằng tiếng Việt trong hộp thoại (PRODUCT_AXES_LOCKED)", async () => {
    setup(false);
    const { api } = await import("@/lib/api/client");
    const { ApiError } = await import("@/lib/api/error");
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "PRODUCT_AXES_LOCKED", "Locked"));
    const user = userEvent.setup();
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    await user.click(await within(dialog).findByLabelText("BLK"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu trục" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Chỉ thêm hoặc gỡ trục khi sản phẩm còn Nháp/,
    );
  });

  describe("lý do khoá bộ trục hiện thành chữ (không chỉ title trên nút bị vô hiệu)", () => {
    it("đã rời Nháp: nói rõ bộ trục khoá vì không còn Nháp", async () => {
      setup(false);
      renderDialog(false);
      const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
      expect(
        await within(dialog).findByText(/Bộ trục đã khoá vì sản phẩm không còn ở trạng thái Nháp/),
      ).toBeVisible();
    });

    it("Nháp nhưng đã có biến thể dùng giá trị: nói rõ vì sao không thêm trục, trục nào không gỡ được", async () => {
      setup(true);
      renderDialog(true);
      const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
      expect(
        await within(dialog).findByText(/Không thêm trục mới được vì đã có biến thể dùng giá trị/),
      ).toBeVisible();
      expect(within(dialog).getByText(/không gỡ được trục và không bỏ chọn/)).toBeVisible();
    });

    it("Nháp, chưa khoá: không hiện lý do khoá", async () => {
      setup(false);
      renderDialog(true);
      const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
      await within(dialog).findByRole("combobox", { name: "Thuộc tính của trục 1" });
      expect(within(dialog).queryByText(/Bộ trục đã khoá|Không thêm trục mới được/)).toBeNull();
    });
  });

  it("hết thuộc tính Chọn một / Màu sắc để thêm: gợi ý + link trang Thuộc tính mở tab mới", async () => {
    // Từ điển chỉ còn COLOR (đã là trục) và NOTE (TEXT — không làm trục được)
    setup(false, [dictionary[0], dictionary[2]]);
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    expect(await within(dialog).findByText(/Không còn thuộc tính kiểu Chọn một/)).toBeVisible();
    const link = within(dialog).getByRole("link", { name: /trang Thuộc tính/ });
    expect(link).toHaveAttribute("href", "/admin/attributes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(dialog).getByRole("button", { name: /Thêm trục/ })).toBeDisabled();
  });

  it("còn thuộc tính để thêm: không hiện gợi ý trang Thuộc tính", async () => {
    setup(false);
    renderDialog(true);
    const dialog = await screen.findByRole("dialog", { name: "Trục biến thể" });
    await within(dialog).findByRole("combobox", { name: "Thuộc tính của trục 1" });
    expect(within(dialog).queryByRole("link", { name: /trang Thuộc tính/ })).toBeNull();
  });
});
