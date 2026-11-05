import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installApi, renderApp } from "../product-test-utils";
import { GenerateVariantsDialog } from "./GenerateVariantsDialog";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const opt = (attrCode: string, code: string, label = code, active = true) => ({
  valueId: `${attrCode}-${code}`,
  code,
  label,
  hexColor: null,
  valueNumber: null,
  active,
  usedByVariant: false,
});
const axis = (attributeId: string, code: string, name: string, codes: string[]) => ({
  attributeId,
  code,
  name,
  dataType: "SELECT",
  sortOrder: attributeId === "a-color" ? 0 : 1,
  options: codes.map((c) => opt(code, c)),
});
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const variant = (sku: string, options: { attr: string; code: string }[], over = {}) => ({
  variantId: `id-${sku}`,
  productId: PRODUCT,
  sku,
  name: sku,
  status: "DRAFT",
  defaultVariant: false,
  attributeSignature: null,
  position: 0,
  obsoletedAt: null,
  version: 0,
  options: options.map((o) => ({
    attributeId: o.attr === "COLOR" ? "a-color" : "a-size",
    attributeCode: o.attr,
    valueId: `${o.attr}-${o.code}`,
    valueCode: o.code,
    label: o.code,
  })),
  ...over,
});

afterEach(() => vi.restoreAllMocks());

function setup(
  existing: ReturnType<typeof variant>[],
  axes = [
    axis("a-color", "COLOR", "Màu", ["WHT", "BLK"]),
    axis("a-size", "SIZE", "Cỡ", ["S", "M", "L"]),
  ],
  post?: (url: string, body: unknown) => unknown,
) {
  return installApi({
    permissions: [],
    get: (url) => {
      if (url === `/products/${PRODUCT}/attributes`)
        return { productId: PRODUCT, axes, descriptives: [] };
      if (url === `/products/${PRODUCT}/variants`) return page(existing);
      return undefined;
    },
    post: (url, body) => post?.(url, body),
  });
}

const renderDialog = () =>
  renderApp(
    <GenerateVariantsDialog productId={PRODUCT} productCode="cup" open onOpenChange={vi.fn()} />,
  );

describe("GenerateVariantsDialog — POST /products/{id}/variants/generation", () => {
  it("xem trước: tổng tổ hợp, đã có, sẽ tạo và SKU dự kiến theo quy tắc MÃ-GIÁ_TRỊ-GIÁ_TRỊ", async () => {
    setup([
      variant("CUP-WHT-S", [
        { attr: "COLOR", code: "WHT" },
        { attr: "SIZE", code: "S" },
      ]),
    ]);
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    expect(await within(dialog).findByText(/tổ hợp ·/)).toHaveTextContent(
      "6 tổ hợp · 1 đã có · 5 sẽ tạo mới",
    );
    expect(within(dialog).getByText("CUP-WHT-M")).toBeInTheDocument();
    expect(within(dialog).queryByText("CUP-WHT-S")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sinh 5 biến thể" })).toBeEnabled();
  });

  it("không bỏ chọn gì thì gửi body rỗng; kết quả liệt kê SKU / tên vừa tạo và số tổ hợp đã có", async () => {
    const created = [
      variant("CUP-BLK-S", [{ attr: "COLOR", code: "BLK" }], {
        name: "Ly – BLK / S",
        variantId: "new-1",
      }),
    ];
    const { post } = setup([], undefined, () => ({ created, skipped: 2 }));
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    await user.click(await within(dialog).findByRole("button", { name: "Sinh 6 biến thể" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/products/${PRODUCT}/variants/generation`, {}),
    );
    const result = await screen.findByRole("dialog", { name: "Đã sinh biến thể" });
    expect(
      within(result).getByText(/Tạo 1 biến thể mới \(Nháp\); 2 tổ hợp đã có/),
    ).toBeInTheDocument();
    expect(within(result).getByText("CUP-BLK-S")).toBeInTheDocument();
    expect(within(result).getByText("Ly – BLK / S")).toBeInTheDocument();
  });

  it("bỏ chọn một giá trị: chỉ gửi trục bị hạn chế với các giá trị còn lại", async () => {
    const { post } = setup([], undefined, () => ({ created: [], skipped: 0 }));
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    await user.click(await within(dialog).findByLabelText("M"));
    await user.click(within(dialog).getByLabelText("L"));
    expect(await within(dialog).findByText(/tổ hợp ·/)).toHaveTextContent("2 tổ hợp");
    await user.click(within(dialog).getByRole("button", { name: "Sinh 2 biến thể" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/products/${PRODUCT}/variants/generation`, {
        optionValueIds: { "a-size": ["SIZE-S"] },
      }),
    );
  });

  it("quá 100 biến thể cần tạo → chặn và báo; trục không còn giá trị nào cũng chặn", async () => {
    const many = Array.from({ length: 11 }, (_, i) => `B${i}`);
    const ten = Array.from({ length: 10 }, (_, i) => `T${i}`);
    setup([], [axis("a-color", "COLOR", "Màu", many), axis("a-size", "SIZE", "Cỡ", ten)]);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Tối đa 100 biến thể mỗi lần sinh/,
    );
    expect(within(dialog).getByRole("button", { name: /Sinh 110 biến thể/ })).toBeDisabled();
    await user.click(within(dialog).getByLabelText("B0"));
    expect(await within(dialog).findByText(/tổ hợp ·/)).toHaveTextContent("100 tổ hợp");
    expect(within(dialog).getByRole("button", { name: "Sinh 100 biến thể" })).toBeEnabled();
  });

  it("mọi tổ hợp đã có → không sinh được; biến thể mặc định chưa gán được nhắc nhở", async () => {
    setup(
      [variant("CUP", [], { defaultVariant: true })],
      [axis("a-color", "COLOR", "Màu", ["WHT"])],
    );
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    expect(await within(dialog).findByText(/nhận tổ hợp đầu tiên/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sinh 1 biến thể" })).toBeEnabled();
  });

  it("lỗi BE hiện bằng tiếng Việt (VARIANT_MATRIX_TOO_LARGE)", async () => {
    const { api } = await import("@/lib/api/client");
    const { ApiError } = await import("@/lib/api/error");
    setup([]);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(400, "VARIANT_MATRIX_TOO_LARGE", "Too many"),
    );
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Sinh tổ hợp biến thể" });
    await user.click(await within(dialog).findByRole("button", { name: "Sinh 6 biến thể" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Quá nhiều biến thể cho một lần sinh/,
    );
  });
});
