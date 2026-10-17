import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_STATUS } from "@/constants";

import type { Product } from "@/features/product";

const {
  useProductMock,
  discontinueMutateMock,
  suspendMutateMock,
  resumeMutateMock,
  deleteMutateMock,
  useOpenReferencesMock,
  pushMock,
  refetchMock,
} = vi.hoisted(() => ({
  useProductMock: vi.fn(),
  discontinueMutateMock: vi.fn(),
  suspendMutateMock: vi.fn(),
  resumeMutateMock: vi.fn(),
  deleteMutateMock: vi.fn(),
  useOpenReferencesMock: vi.fn(),
  pushMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/lib/auth/components/Can", () => ({
  useCan: () => true,
  usePermissionChecker: () => () => true,
}));

vi.mock("@/features/product", async () => {
  const actual = await vi.importActual<typeof import("@/features/product")>("@/features/product");
  const idle = { isPending: false, mutateAsync: vi.fn(), mutate: vi.fn() };
  return {
    ...actual,
    useProduct: useProductMock,
    useVariants: () => ({ data: [], isLoading: false }),
    useCategories: () => ({ data: { items: [] }, isLoading: false }),
    useTransitionProduct: () => idle,
    usePublishProduct: () => idle,
    useUnpublishProduct: () => idle,
    useDiscontinueProduct: () => ({ isPending: false, mutate: discontinueMutateMock }),
    useSuspendProduct: () => ({ isPending: false, mutate: suspendMutateMock }),
    useResumeProduct: () => ({ isPending: false, mutate: resumeMutateMock }),
    useDeleteProduct: () => ({ isPending: false, mutate: deleteMutateMock }),
    useOpenReferences: useOpenReferencesMock,
  };
});

vi.mock("./ProductHistory", () => ({ ProductHistory: () => <div>history</div> }));
vi.mock("./ProductAttributesSection", () => ({
  ProductAttributesSection: () => <div>attributes</div>,
}));
vi.mock("./ProductListingSection", () => ({
  ProductListingSection: () => <div>listing</div>,
}));

vi.mock("./variants/VariantsSection", () => ({ VariantsSection: () => <div>variants</div> }));
vi.mock("./variants/VariantMediaGallery", () => ({
  VariantMediaGallery: () => <div>gallery</div>,
}));

import { ProductDetail } from "./ProductDetail";

const product = (status: Product["status"], version = 3): Product => ({
  productId: "product-1",
  code: "PRD-1",
  name: "Ly giấy",
  nameEn: "Paper cup",
  type: "Standard",
  categoryId: null,
  status,
  version,
  description: "",
  descriptionEn: "",
  images: [],
  taxClass: "standard",
  brand: "Brand",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "tester",
});

/** `React.use` đọc ngay một promise đã đánh dấu fulfilled — không treo ở Suspense trong test. */
const resolvedParams = Object.assign(Promise.resolve({ id: "product-1" }), {
  status: "fulfilled" as const,
  value: { id: "product-1" },
});

async function renderDetail() {
  render(
    <Suspense fallback={null}>
      <ProductDetail params={resolvedParams} />
    </Suspense>,
  );
  return screen.findByRole("button", { name: "Ngừng kinh doanh" });
}

const noReferences = {
  isLoading: false,
  isError: false,
  data: { references: [], truncated: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  useOpenReferencesMock.mockReturnValue(noReferences);
  useProductMock.mockReturnValue({
    data: product(PRODUCT_STATUS.PUBLISHED),
    isLoading: false,
    refetch: refetchMock,
  });
});

describe("ProductDetail — ngừng kinh doanh cần lý do + version (BE DiscontinueProductRequest)", () => {
  it("mở hộp thoại hỏi lý do, gửi { id, reason, version } của lần đọc", async () => {
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));

    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    const confirm = within(dialog).getByRole("button", { name: "Ngừng kinh doanh" });
    expect(confirm).toBeDisabled(); // lý do bắt buộc
    expect(discontinueMutateMock).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole("textbox"), "  Ngừng sản xuất  ");
    await user.click(confirm);

    await waitFor(() =>
      expect(discontinueMutateMock).toHaveBeenCalledWith(
        { id: "product-1", reason: "Ngừng sản xuất", version: 3 },
        expect.any(Object),
      ),
    );
  });

  it("lý do tối đa 500 ký tự (chặn ở ô nhập)", async () => {
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    expect(within(dialog).getByRole("textbox")).toHaveAttribute("maxlength", "500");
  });

  it("409 OPTIMISTIC_LOCK: báo người khác đã sửa trong hộp thoại và tải lại sản phẩm", async () => {
    const user = userEvent.setup();
    discontinueMutateMock.mockImplementation(
      (_input: unknown, options: { onError: (error: unknown) => void }) =>
        options.onError(Object.assign(new Error("x"), { code: "OPTIMISTIC_LOCK" })),
    );
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    await user.type(within(dialog).getByRole("textbox"), "Lý do");
    await user.click(within(dialog).getByRole("button", { name: "Ngừng kinh doanh" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/người khác sửa/);
    expect(refetchMock).toHaveBeenCalled();
  });

  it("sản phẩm tạm ngưng (Inactive) vẫn ngừng kinh doanh được và hiện nhãn Tạm ngưng", async () => {
    useProductMock.mockReturnValue({
      data: product(PRODUCT_STATUS.INACTIVE),
      isLoading: false,
      refetch: refetchMock,
    });
    await renderDetail();
    expect(screen.getAllByText("Tạm ngưng").length).toBeGreaterThan(0);
  });
});

describe("ProductDetail — hộp thoại ngừng kinh doanh hiện chứng từ còn mở và cảnh báo sau khi ngừng", () => {
  it("liệt kê đơn mua / đơn bán còn mở tham chiếu SKU trong hộp thoại, trước khi xác nhận", async () => {
    useOpenReferencesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        references: [
          {
            kind: "PURCHASE_ORDER_LINE",
            documentNumber: "PO-1",
            documentId: "p1",
            sku: "CUP-12OZ",
          },
          { kind: "SALES_ORDER_LINE", documentNumber: "ORD-9", documentId: "o9", sku: "CUP-16OZ" },
        ],
        truncated: false,
      },
    });
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    expect(within(dialog).getByText("PO-1")).toBeInTheDocument();
    expect(within(dialog).getByText("ORD-9")).toBeInTheDocument();
    expect(within(dialog).getByText(/Dòng đơn mua/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Dòng đơn bán/)).toBeInTheDocument();
  });

  it("không tải được chứng từ vẫn ngừng kinh doanh được", async () => {
    useOpenReferencesMock.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    expect(
      within(dialog).getByText(/Không tải được danh sách chứng từ còn mở/),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox"), "Lý do");
    expect(within(dialog).getByRole("button", { name: "Ngừng kinh doanh" })).toBeEnabled();
  });

  it("sau khi ngừng: cảnh báo hiện bằng tiếng Việt kèm chứng từ — không lộ mã OPEN_PURCHASE_ORDER_LINES", async () => {
    discontinueMutateMock.mockImplementation(
      (_input: unknown, options: { onSuccess: (result: unknown) => void }) =>
        options.onSuccess({
          product: product(PRODUCT_STATUS.DISCONTINUED),
          warnings: ["OPEN_PURCHASE_ORDER_LINES", "UNSHIPPED_ORDER_LINES"],
          openReferences: [
            {
              kind: "PURCHASE_ORDER_LINE",
              documentNumber: "PO-7",
              documentId: "p7",
              sku: "CUP-12OZ",
            },
          ],
          openReferencesTruncated: true,
        }),
    );
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    await user.type(within(dialog).getByRole("textbox"), "Hết mẫu");
    await user.click(within(dialog).getByRole("button", { name: "Ngừng kinh doanh" }));

    const result = await screen.findByRole("dialog", { name: "Đã ngừng kinh doanh sản phẩm" });
    expect(within(result).getByText(/dòng đơn mua \(PO\) đang mở/i)).toBeInTheDocument();
    expect(within(result).getByText(/dòng đơn bán đã đặt chưa giao/i)).toBeInTheDocument();
    expect(within(result).getByText("PO-7")).toBeInTheDocument();
    expect(within(result).getByText(/Còn nhiều chứng từ nữa/)).toBeInTheDocument();
    expect(result).not.toHaveTextContent("OPEN_PURCHASE_ORDER_LINES");
    expect(result).not.toHaveTextContent("UNSHIPPED_ORDER_LINES");
  });
});

describe("ProductDetail — tạm ngưng, tiếp tục, xoá nháp (BE SCRUM-461)", () => {
  it("Published: Tạm ngưng hỏi lý do rồi gửi { id, reason, version }", async () => {
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await user.click(await screen.findByRole("button", { name: "Tạm ngưng" }));
    const dialog = await screen.findByRole("dialog", { name: "Tạm ngưng sản phẩm?" });
    const confirm = within(dialog).getByRole("button", { name: "Tạm ngưng" });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("textbox")).toHaveAttribute("maxlength", "500");
    await user.type(within(dialog).getByRole("textbox"), "  Kiểm tra chất lượng  ");
    await user.click(confirm);
    await waitFor(() =>
      expect(suspendMutateMock).toHaveBeenCalledWith(
        { id: "product-1", reason: "Kiểm tra chất lượng", version: 3 },
        expect.any(Object),
      ),
    );
  });

  it("Inactive: hiện lý do + thời điểm tạm ngưng; Tiếp tục gửi { id, version }", async () => {
    useProductMock.mockReturnValue({
      data: {
        ...product(PRODUCT_STATUS.INACTIVE, 5),
        suspendedAt: "2026-02-01T00:00:00Z",
        suspendReason: "Đợi lô hàng mới",
      },
      isLoading: false,
      refetch: refetchMock,
    });
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    expect(await screen.findByText("Đợi lô hàng mới")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tiếp tục kinh doanh" }));
    const dialog = await screen.findByRole("dialog", { name: "Tiếp tục kinh doanh?" });
    expect(within(dialog).getByText(/xuất bản lại/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Tiếp tục kinh doanh" }));
    await waitFor(() =>
      expect(resumeMutateMock).toHaveBeenCalledWith(
        { id: "product-1", version: 5 },
        expect.any(Object),
      ),
    );
  });

  it("Draft: Xoá sản phẩm cần xác nhận, gửi { id, version } và về danh sách khi xong", async () => {
    useProductMock.mockReturnValue({
      data: product(PRODUCT_STATUS.DRAFT, 2),
      isLoading: false,
      refetch: refetchMock,
    });
    deleteMutateMock.mockImplementation((_input: unknown, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await user.click(await screen.findByRole("button", { name: "Xoá sản phẩm" }));
    const dialog = await screen.findByRole("dialog", { name: "Xoá sản phẩm nháp?" });
    expect(deleteMutateMock).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Xoá sản phẩm" }));
    await waitFor(() =>
      expect(deleteMutateMock).toHaveBeenCalledWith(
        { id: "product-1", version: 2 },
        expect.any(Object),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/admin/products");
  });

  it("xoá bị từ chối (PRODUCT_IN_USE) → báo trong hộp thoại bằng tiếng Việt, không điều hướng", async () => {
    useProductMock.mockReturnValue({
      data: product(PRODUCT_STATUS.DRAFT, 2),
      isLoading: false,
      refetch: refetchMock,
    });
    deleteMutateMock.mockImplementation(
      (_input: unknown, options: { onError: (error: unknown) => void }) =>
        options.onError(Object.assign(new Error("x"), { code: "PRODUCT_IN_USE" })),
    );
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await user.click(await screen.findByRole("button", { name: "Xoá sản phẩm" }));
    const dialog = await screen.findByRole("dialog", { name: "Xoá sản phẩm nháp?" });
    await user.click(within(dialog).getByRole("button", { name: "Xoá sản phẩm" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/không xoá được/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
