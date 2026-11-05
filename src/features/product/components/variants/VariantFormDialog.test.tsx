import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { VariantFormDialog } from "./VariantFormDialog";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

const axis = (attributeId: string, code: string, name: string, labels: [string, boolean][]) => ({
  attributeId,
  code,
  name,
  dataType: "TEXT",
  sortOrder: 0,
  options: labels.map(([label, active]) => ({
    valueId: `${code}-${label}`,
    code: label.toUpperCase(),
    label,
    hexColor: null,
    valueNumber: null,
    active,
    usedByVariant: false,
  })),
});

const AXES = [
  axis("a-color", "COLOR", "Màu", [
    ["Trắng", true],
    ["Cũ", false],
  ]),
  axis("a-size", "SIZE", "Cỡ", [["12oz", true]]),
];

function mockAxes(axes: unknown[]) {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === `/products/${PRODUCT}/attributes`) {
      return { data: { productId: PRODUCT, axes, descriptives: [] } };
    }
    throw new Error(`Không có mock cho GET ${url}`);
  });
}

function renderDialog(variant?: Parameters<typeof VariantFormDialog>[0]["variant"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VariantFormDialog productId={PRODUCT} variant={variant} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  // Radix Select cần các API này; jsdom không có.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => vi.restoreAllMocks());

describe("VariantFormDialog — theo trục của sản phẩm (BE VariantRequest.optionValueIds)", () => {
  it("sản phẩm không có trục: SKU + tên bắt buộc, không còn ô 'Tổ hợp thuộc tính', gửi optionValueIds rỗng → bỏ qua", async () => {
    const user = userEvent.setup();
    mockAxes([]);
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        variantId: "v-1",
        productId: PRODUCT,
        sku: "CUP_12",
        name: "Ly",
        status: "DRAFT",
        defaultVariant: true,
        position: 0,
        version: 0,
        options: [],
      },
    });
    renderDialog();

    const submit = await screen.findByRole("button", { name: "Thêm biến thể" });
    await waitFor(() => expect(screen.queryByText(/Đang tải thuộc tính/)).not.toBeInTheDocument());
    expect(screen.queryByLabelText(/Tổ hợp thuộc tính/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mã SKU *")).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Mã SKU *"), "CUP_12");
    await user.type(screen.getByLabelText("Tên biến thể *"), "Ly");
    await user.click(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/products/${PRODUCT}/variants`, {
        sku: "CUP_12",
        name: "Ly",
      }),
    );
  });

  it("sản phẩm có trục: mỗi trục một ô chọn, SKU / tên tuỳ chọn, gửi optionValueIds", async () => {
    const user = userEvent.setup();
    mockAxes(AXES);
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        variantId: "v-2",
        productId: PRODUCT,
        sku: "CUP-12-TRANG-12OZ",
        name: "Ly – Trắng / 12oz",
        status: "DRAFT",
        defaultVariant: false,
        position: 1,
        version: 0,
        options: [],
      },
    });
    renderDialog();

    const color = await screen.findByRole("combobox", { name: /Màu/ });
    const size = screen.getByRole("combobox", { name: /Cỡ/ });
    expect(screen.getByLabelText("Mã SKU")).toBeInTheDocument(); // không có dấu * — tuỳ chọn
    expect(screen.getByLabelText("Tên biến thể")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Thêm biến thể" });
    expect(submit).toBeDisabled();

    await user.click(color);
    // Giá trị đã bị vô hiệu trong từ điển ("Cũ") không được chọn cho biến thể mới.
    expect(screen.queryByRole("option", { name: "Cũ" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Trắng" }));
    expect(submit).toBeDisabled(); // còn thiếu trục Cỡ
    await user.click(size);
    await user.click(await screen.findByRole("option", { name: "12oz" }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/products/${PRODUCT}/variants`, {
        optionValueIds: ["COLOR-Trắng", "SIZE-12oz"],
      }),
    );
  });

  it("không tải được trục → báo lỗi và không cho gửi", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("boom"));
    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Không tải được thuộc tính/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm biến thể" })).toBeDisabled();
  });
});
