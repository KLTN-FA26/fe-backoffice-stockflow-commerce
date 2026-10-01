import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { apiPage } from "../__fixtures__/supplier";
import { PERMISSION_SETS, mockApiGet, renderSupplierScreen } from "../__fixtures__/render";
import { SupplierList } from "./SupplierList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("SupplierList — action-gating theo mã quyền (/me/permissions)", () => {
  it("không có quyền NCC → 'Bạn không có quyền', không gọi danh sách", async () => {
    const get = mockApiGet(PERMISSION_SETS.none, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/suppliers")).toBe(false);
  });

  it("chỉ VIEW_PAGE + READ → thấy bảng, không có nút Thêm và không chọn nhiều dòng", async () => {
    mockApiGet(PERMISSION_SETS.readOnly, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Công ty TNHH Dệt may Thành Công")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Thêm nhà cung cấp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("có CREATE + UPDATE → có nút Thêm, vẫn không chọn nhiều dòng (thiếu DELETE)", async () => {
    mockApiGet(PERMISSION_SETS.editor, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByRole("link", { name: /Thêm nhà cung cấp/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("đủ quyền kể cả DELETE → có ô chọn dòng cho ngừng hợp tác hàng loạt", async () => {
    mockApiGet(PERMISSION_SETS.full, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Công ty TNHH Dệt may Thành Công")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });
});

describe("SupplierList — trạng thái dữ liệu", () => {
  it("lỗi tải 500 → màn lỗi + Thử lại, KHÔNG nuốt thành danh sách trống", async () => {
    mockApiGet(PERMISSION_SETS.readOnly, {
      "/suppliers": () => {
        throw new ApiError(500, "INTERNAL_ERROR", "Lỗi hệ thống");
      },
    });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Không tải được dữ liệu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByText("Chưa có nhà cung cấp")).not.toBeInTheDocument();
  });

  it("dữ liệu sai hợp đồng → 'Dữ liệu trả về không đúng định dạng'", async () => {
    mockApiGet(PERMISSION_SETS.readOnly, { "/suppliers": () => ({ items: "sai" }) });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
  });

  it("chưa có dữ liệu và lọc không khớp là hai màn trống khác nhau", async () => {
    mockApiGet(PERMISSION_SETS.editor, { "/suppliers": () => apiPage([]) });
    const { unmount } = renderSupplierScreen(<SupplierList />);
    expect(await screen.findByText("Chưa có nhà cung cấp")).toBeInTheDocument();
    unmount();

    renderSupplierScreen(<SupplierList />, "?q=khongco");
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ bộ lọc" })).toBeInTheDocument();
  });

  it("gửi phân trang/lọc lên server từ URL (trang 2 → page=1, status=INACTIVE)", async () => {
    const get = mockApiGet(PERMISSION_SETS.readOnly, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />, "?page=2&status=Inactive&sort=name,desc");

    await screen.findByText("Công ty TNHH Dệt may Thành Công");
    const call = get.mock.calls.find(([url]) => url === "/suppliers");
    const params = call?.[1]?.params as URLSearchParams;
    expect(params.get("page")).toBe("1");
    expect(params.get("status")).toBe("INACTIVE");
    expect(params.get("sort")).toBe("name,desc");
  });
});
