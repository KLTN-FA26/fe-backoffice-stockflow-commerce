import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";

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
  transitionMutateMock,
} = vi.hoisted(() => ({
  transitionMutateMock: vi.fn(),
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
    useTransitionProduct: () => ({ ...idle, mutate: transitionMutateMock }),
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
// Nút thêm / sinh trên tiêu đề mục Biến thể đọc trục qua React Query — test riêng ở VariantsSection.test.
vi.mock("./variants/VariantsActions", () => ({ VariantsActions: () => null }));
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

  // Tải lại sản phẩm khi 409 nằm ở mutation (withStaleRefetch, mutations.test.tsx).
  it("409 OPTIMISTIC_LOCK: báo người khác đã sửa trong hộp thoại", async () => {
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

  it("đang tải lại khi mở hộp thoại: không trình bày danh sách cũ (thẻ cột phải) như số liệu hiện tại", async () => {
    // Thẻ và hộp thoại dùng chung khoá: hộp thoại mở ra có thể thấy dữ liệu thẻ đã tải trong khi
    // đang lấy bản mới — phải nói đang kiểm tra, không đưa danh sách cũ trước nút xác nhận.
    useOpenReferencesMock.mockReturnValue({
      isLoading: false,
      isFetching: true,
      isError: false,
      data: {
        references: [
          { kind: "PURCHASE_ORDER_LINE", documentNumber: "PO-OLD", documentId: "p", sku: "CUP" },
        ],
        truncated: false,
      },
    });
    const user = userEvent.setup();
    await renderDetail().then((button) => user.click(button));
    const dialog = await screen.findByRole("dialog", { name: "Ngừng kinh doanh sản phẩm?" });
    expect(within(dialog).getByText(/Đang kiểm tra chứng từ còn mở/)).toBeInTheDocument();
    expect(within(dialog).queryByText("PO-OLD")).not.toBeInTheDocument();
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

describe("ProductDetail — từ chối duyệt qua hộp thoại có lý do, không còn window.prompt", () => {
  it("Pending Approval: Từ chối mở hộp thoại, lý do bắt buộc, gửi { id, action: reject, reason }", async () => {
    useProductMock.mockReturnValue({
      data: product(PRODUCT_STATUS.PENDING_APPROVAL),
      isLoading: false,
      refetch: refetchMock,
    });
    const prompt = vi.spyOn(window, "prompt");
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await user.click(await screen.findByRole("button", { name: "Từ chối" }));
    const dialog = await screen.findByRole("dialog", { name: "Từ chối duyệt sản phẩm?" });
    const confirm = within(dialog).getByRole("button", { name: "Từ chối" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "  Thiếu ảnh bìa ");
    await user.click(confirm);

    await waitFor(() =>
      expect(transitionMutateMock).toHaveBeenCalledWith(
        { id: "product-1", action: "reject", reason: "Thiếu ảnh bìa" },
        expect.any(Object),
      ),
    );
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe("ProductDetail — mục Mô tả", () => {
  async function openDescription() {
    const user = userEvent.setup();
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await user.click(await screen.findByRole("button", { name: "Mô tả" }));
  }

  it("mô tả rỗng (BE không trả / chuỗi trắng): hiện 'Chưa có mô tả', không để mục trống", async () => {
    useProductMock.mockReturnValue({
      data: { ...product(PRODUCT_STATUS.DRAFT), description: "  ", descriptionEn: "" },
      isLoading: false,
      refetch: refetchMock,
    });
    await openDescription();
    expect(await screen.findByText(UI_LABELS.product.description.empty)).toBeInTheDocument();
  });

  it("có mô tả: hiện cả tiếng Việt lẫn tiếng Anh", async () => {
    useProductMock.mockReturnValue({
      data: {
        ...product(PRODUCT_STATUS.DRAFT),
        description: "Ly giấy 2 lớp",
        descriptionEn: "Double-wall paper cup",
      },
      isLoading: false,
      refetch: refetchMock,
    });
    await openDescription();
    expect(await screen.findByText("Ly giấy 2 lớp")).toBeInTheDocument();
    expect(screen.getByText("Double-wall paper cup")).toBeInTheDocument();
    expect(screen.queryByText(UI_LABELS.product.description.empty)).not.toBeInTheDocument();
  });
});

describe("ProductDetail — thẻ Chứng từ còn mở ở cột phải", () => {
  const renderPage = () =>
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );

  it("đã xuất bản: thẻ luôn hiện (không cần mở hộp thoại ngừng kinh doanh)", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: UI_LABELS.product.openReferences.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.product.openReferences.empty)).toBeInTheDocument();
    expect(useOpenReferencesMock).toHaveBeenCalledWith("product-1", true, { cached: true });
  });

  it("nháp: không có thẻ", async () => {
    useProductMock.mockReturnValue({
      data: product(PRODUCT_STATUS.DRAFT),
      isLoading: false,
      refetch: refetchMock,
    });
    renderPage();
    await screen.findByRole("button", { name: "Gửi duyệt" });
    expect(
      screen.queryByRole("heading", { name: UI_LABELS.product.openReferences.title }),
    ).not.toBeInTheDocument();
  });
});

describe("ProductDetail — breadcrumb và nhóm thuế", () => {
  it("breadcrumb hiện mã sản phẩm thay cho UUID trên URL; nhóm thuế nhãn tiếng Việt", async () => {
    useProductMock.mockReturnValue({
      data: { ...product(PRODUCT_STATUS.PUBLISHED), taxClass: "reduced" },
      isLoading: false,
      refetch: refetchMock,
    });
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
    await screen.findByRole("button", { name: "Ngừng kinh doanh" });
    expect(useBreadcrumbLabelStore.getState().labels["product-1"]).toBe("PRD-1");
    expect(screen.getByText("Giảm thuế")).toBeInTheDocument();
    expect(screen.queryByText("reduced")).not.toBeInTheDocument();
  });
});

describe("ProductDetail — lỗi tải: chỉ 404 mới là không tìm thấy (api-conventions §8)", () => {
  const renderError = (error: unknown) => {
    useProductMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error,
      refetch: refetchMock,
    });
    render(
      <Suspense fallback={null}>
        <ProductDetail params={resolvedParams} />
      </Suspense>,
    );
  };

  it("404 PRODUCT_NOT_FOUND: báo không tìm thấy, không có nút thử lại, không nhắc dữ liệu mock", async () => {
    renderError(new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found"));
    expect(await screen.findByText(UI_LABELS.product.notFound.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByText(/mock/)).not.toBeInTheDocument();
  });

  it("500: báo lỗi máy chủ + traceId, nút Thử lại gọi refetch", async () => {
    renderError(new ApiError(500, "INTERNAL", "boom", undefined, "trace-123"));
    expect(await screen.findByText(UI_LABELS.loadError.serverTitle)).toBeInTheDocument();
    expect(screen.queryByText(UI_LABELS.product.notFound.title)).not.toBeInTheDocument();
    expect(screen.getByText("trace-123")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: UI_LABELS.common.retry }));
    expect(refetchMock).toHaveBeenCalled();
  });

  it("mất mạng: báo không kết nối được máy chủ, không thành không tìm thấy", async () => {
    renderError(new ApiError(0, "NETWORK_ERROR", "Network"));
    expect(await screen.findByText(UI_LABELS.loadError.networkTitle)).toBeInTheDocument();
  });

  it("403: báo không có quyền, không có nút thử lại", async () => {
    renderError(new ApiError(403, "FORBIDDEN", "Forbidden"));
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.common.retry })).not.toBeInTheDocument();
  });
});
