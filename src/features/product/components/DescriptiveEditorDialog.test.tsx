import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installApi, pickOption, renderApp } from "../product-test-utils";
import { DescriptiveEditorDialog } from "./DescriptiveEditorDialog";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const attr = (
  attributeId: string,
  code: string,
  dataType: string,
  values: { code: string; active?: boolean }[] = [],
  unit: string | null = null,
  active = true,
) => ({
  attributeId,
  code,
  name: `Tên ${code}`,
  dataType,
  unit,
  filterable: false,
  searchable: false,
  sortOrder: 0,
  active,
  version: 0,
  values: values.map((v, i) => ({
    valueId: `${code}-${v.code}`,
    code: v.code,
    label: `Nhãn ${v.code}`,
    valueNumber: null,
    hexColor: null,
    sortOrder: i,
    active: v.active ?? true,
    version: 0,
  })),
});
const dictionary = [
  attr("a-text", "MATERIAL", "TEXT"),
  attr("a-num", "WEIGHT", "NUMBER", [], "kg"),
  attr("a-bool", "ORGANIC", "BOOLEAN"),
  attr("a-sel", "ORIGIN", "SELECT", [{ code: "VN" }, { code: "TH" }]),
  attr("a-multi", "CERT", "MULTISELECT", [{ code: "ISO" }, { code: "FSC" }]),
  attr("a-axis", "COLOR", "SELECT", [{ code: "WHT" }]),
  attr("a-off", "OLD", "TEXT", [], null, false),
];
const current = (descriptives: unknown[] = []) => ({
  productId: PRODUCT,
  axes: [
    {
      attributeId: "a-axis",
      code: "COLOR",
      name: "Màu",
      dataType: "SELECT",
      sortOrder: 0,
      options: [],
    },
  ],
  descriptives,
});

afterEach(() => vi.restoreAllMocks());

function setup(descriptives: unknown[] = []) {
  return installApi({
    permissions: [],
    get: (url) => {
      if (url === `/products/${PRODUCT}/attributes`) return current(descriptives);
      if (url === "/attributes") {
        return {
          items: dictionary,
          page: 0,
          size: 200,
          totalElements: dictionary.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
      }
      return undefined;
    },
    put: (url) => (url === `/products/${PRODUCT}/descriptive-attributes` ? current() : undefined),
  });
}

const renderDialog = () =>
  renderApp(<DescriptiveEditorDialog productId={PRODUCT} open onOpenChange={vi.fn()} />);

describe("DescriptiveEditorDialog — PUT /products/{id}/descriptive-attributes", () => {
  it("chỉ thêm được thuộc tính đang dùng, không phải trục của sản phẩm; mỗi loại có ô nhập đúng kiểu và gửi đúng trường", async () => {
    const { put } = setup();
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Thuộc tính mô tả" });
    const add = async (name: string) => {
      await user.click(
        await within(dialog).findByRole("combobox", { name: "Thêm thuộc tính mô tả" }),
      );
      if (name === "MATERIAL") {
        // Danh sách không có COLOR (đang là trục) và OLD (đã ngừng dùng).
        const labels = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(labels).not.toContain("Tên COLOR (COLOR)");
        expect(labels).not.toContain("Tên OLD (OLD)");
      }
      await user.click(await screen.findByRole("option", { name: new RegExp(`${name}\\)`) }));
    };
    await add("MATERIAL");
    await user.type(within(dialog).getByLabelText("Nội dung"), "  Cotton  ");
    await add("WEIGHT");
    await user.type(within(dialog).getByLabelText("Số"), "12.5");
    await add("ORGANIC");
    await pickOption(user, "Giá trị", "Không");
    await add("CERT");
    await user.click(within(dialog).getByLabelText("Nhãn FSC"));
    await user.click(within(dialog).getByRole("button", { name: "Lưu thuộc tính" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/descriptive-attributes`, {
        attributes: [
          { attributeId: "a-text", sortOrder: 0, text: "Cotton" },
          { attributeId: "a-num", sortOrder: 1, number: 12.5 },
          { attributeId: "a-bool", sortOrder: 2, bool: false },
          { attributeId: "a-multi", sortOrder: 3, valueIds: ["CERT-FSC"] },
        ],
      }),
    );
  });

  it("giá trị chưa hợp lệ chặn lưu và báo ngay dưới từng thuộc tính", async () => {
    setup();
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Thuộc tính mô tả" });
    await user.click(
      await within(dialog).findByRole("combobox", { name: "Thêm thuộc tính mô tả" }),
    );
    await user.click(await screen.findByRole("option", { name: /WEIGHT\)/ }));
    await user.type(within(dialog).getByLabelText("Số"), "abc");
    expect(
      within(dialog).getByText(/Nhập số \(tối đa 14 chữ số nguyên, 4 số lẻ\)/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Lưu thuộc tính" })).toBeDisabled();
  });

  it("nạp giá trị hiện có, gỡ hết rồi lưu gửi danh sách rỗng (xoá toàn bộ)", async () => {
    const { put } = setup([
      {
        attributeId: "a-text",
        code: "MATERIAL",
        name: "Tên MATERIAL",
        dataType: "TEXT",
        unit: null,
        sortOrder: 0,
        values: [],
        text: "Lanh",
        number: null,
        bool: null,
      },
    ]);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Thuộc tính mô tả" });
    expect(await within(dialog).findByLabelText("Nội dung")).toHaveValue("Lanh");
    await user.click(within(dialog).getByRole("button", { name: /Gỡ thuộc tính/ }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu thuộc tính" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`/products/${PRODUCT}/descriptive-attributes`, {
        attributes: [],
      }),
    );
  });
});
