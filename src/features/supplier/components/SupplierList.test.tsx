import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SUPPLIER_PERMISSIONS } from "@/constants";
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
    // Không dẫn về đúng màn đang bị chặn
    expect(screen.queryByRole("link", { name: "Về danh sách" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang tổng quan" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("chỉ VIEW_PAGE + READ → thấy bảng, không có nút Thêm và không chọn nhiều dòng", async () => {
    mockApiGet(PERMISSION_SETS.readOnly, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Công ty TNHH Dệt may Thành Công")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Thêm nhà cung cấp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    // Thiếu EXPORT → không có nút Xuất Excel
    expect(screen.queryByRole("button", { name: /Xuất Excel/ })).not.toBeInTheDocument();
  });

  it("có EXPORT → có nút Xuất Excel (base UI, chưa có API)", async () => {
    const { viewPage, read, export: exportCode } = SUPPLIER_PERMISSIONS;
    mockApiGet([viewPage, read, exportCode], { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);
    expect(await screen.findByRole("button", { name: /Xuất Excel/ })).toBeInTheDocument();
  });

  it("cột kênh gửi PO hiện 'Email', không hiện enum thô EMAIL", async () => {
    mockApiGet(PERMISSION_SETS.readOnly, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);
    expect(await screen.findByText("Email")).toBeInTheDocument();
    expect(screen.queryByText("EMAIL")).not.toBeInTheDocument();
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

describe("SupplierList — VIEW_PAGE (mở trang) tách khỏi READ (đọc dữ liệu)", () => {
  it("chỉ VIEW_PAGE → vào được trang, báo không có quyền xem dữ liệu, KHÔNG gọi /suppliers", async () => {
    const get = mockApiGet(PERMISSION_SETS.viewOnly, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Quản lý nhà cung cấp")).toBeInTheDocument();
    expect(screen.getByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/suppliers")).toBe(false);
    // Không có dữ liệu để lọc → không hiện ô tìm kiếm / lọc / thanh Cấu hình
    expect(screen.queryByPlaceholderText(/Tìm theo mã NCC/)).not.toBeInTheDocument();
    expect(screen.queryByText("Cấu hình")).not.toBeInTheDocument();
  });

  it("chỉ READ (thiếu VIEW_PAGE) → bị chặn route, không vào được trang", async () => {
    const get = mockApiGet(PERMISSION_SETS.readNoPage, { "/suppliers": () => apiPage() });
    renderSupplierScreen(<SupplierList />);

    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(screen.queryByText("Quản lý nhà cung cấp")).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/suppliers")).toBe(false);
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
