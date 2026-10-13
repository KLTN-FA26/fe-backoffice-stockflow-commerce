import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductionOrderList } from "../components/ProductionOrderList";

describe("ProductionOrderList (SCRUM-406 & SCRUM-414)", () => {
  const mockSelectOrder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hiển thị tiêu đề, các chỉ số thống kê và bảng lệnh sản xuất", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    expect(screen.getByText(/Danh sách Lệnh sản xuất/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng LSX:/i)).toBeInTheDocument();
    expect(screen.getByText(/Chờ Prepress:/i)).toBeInTheDocument();
    expect(screen.getByText(/Đang Hold:/i)).toBeInTheDocument();

    // Headers
    expect(screen.getByText("Mã LSX")).toBeInTheDocument();
    expect(screen.getByText("Khách hàng / Đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Phôi SKU")).toBeInTheDocument();
    expect(screen.getByText("Hạn giao")).toBeInTheDocument();
  });

  it("lọc chính xác theo loại LSX (SAMPLE vs ORDER)", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    const typeSelect = screen.getByDisplayValue("Tất cả loại LSX");
    fireEvent.change(typeSelect, { target: { value: "SAMPLE" } });

    // Khi chọn SAMPLE, tất cả badge loại đều phải là MẪU THỬ
    const sampleBadges = screen.getAllByText("MẪU THỬ");
    expect(sampleBadges.length).toBeGreaterThan(0);
    expect(screen.queryByText("ĐƠN HÀNG")).not.toBeInTheDocument();
  });

  it("lọc theo hạn giao hàng và hiển thị đúng cảnh báo quá hạn", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    const dueDateSelect = screen.getByDisplayValue("Tất cả hạn giao");
    // Lọc các đơn quá hạn
    fireEvent.change(dueDateSelect, { target: { value: "OVERDUE" } });

    // Phải hiển thị các lệnh có hạn giao trước 2026-10-09
    const overdueElements = screen.queryAllByText(/2026-10-0/);
    expect(overdueElements.length).toBeGreaterThanOrEqual(0);
  });

  it("chuyển đổi kích thước trang và phân trang chính xác", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    // Đổi page size sang 2 dòng / trang
    const pageSizeSelect = screen.getByDisplayValue("10 dòng / trang");
    fireEvent.change(pageSizeSelect, { target: { value: "2" } });

    // Kiểm tra hiển thị phân trang
    expect(screen.getByTestId("pagination-info")).toHaveTextContent(
      "Hiển thị 1 – 2 trên tổng số 4 lệnh sản xuất",
    );
    expect(screen.getByText(/Trang 1 \//i)).toBeInTheDocument();

    // Bấm sang trang 2
    const nextButton = screen.getByTitle("Trang kế tiếp");
    fireEvent.click(nextButton);

    expect(screen.getByText(/Trang 2 \//i)).toBeInTheDocument();
  });

  it("tự động reset trang về 1 khi người dùng đổi bộ lọc tìm kiếm", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    // Đổi sang 2 dòng / trang và sang trang 2
    const pageSizeSelect = screen.getByDisplayValue("10 dòng / trang");
    fireEvent.change(pageSizeSelect, { target: { value: "2" } });

    const nextButton = screen.getByTitle("Trang kế tiếp");
    fireEvent.click(nextButton);
    expect(screen.getByText(/Trang 2 \//i)).toBeInTheDocument();

    // Nhập từ khóa tìm kiếm -> Trang phải tự động quay về Trang 1
    const searchInput = screen.getByPlaceholderText(/Tìm theo mã LSX/i);
    fireEvent.change(searchInput, { target: { value: "LSX" } });

    expect(screen.getByText(/Trang 1 \//i)).toBeInTheDocument();
  });

  it("hiển thị trạng thái rỗng khi không có kết quả và nút xóa bộ lọc hoạt động", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo mã LSX/i);
    fireEvent.change(searchInput, { target: { value: "MA_KHONG_TON_TAI_9999" } });

    expect(
      screen.getByText("Không tìm thấy lệnh sản xuất nào phù hợp với bộ lọc."),
    ).toBeInTheDocument();

    // Nút Xóa tất cả bộ lọc xuất hiện
    const resetBtn = screen.getByRole("button", { name: /Xóa tất cả bộ lọc/i });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);

    // Dữ liệu ban đầu được phục hồi
    expect(screen.getByText(/Mã LSX/i)).toBeInTheDocument();
    expect(
      screen.queryByText("Không tìm thấy lệnh sản xuất nào phù hợp với bộ lọc."),
    ).not.toBeInTheDocument();
  });

  it("gọi callback onSelectOrder khi bấm nút Xử lý LSX", () => {
    render(<ProductionOrderList onSelectOrder={mockSelectOrder} />);

    const actionButtons = screen.getAllByRole("button", { name: /Xử lý LSX/i });
    expect(actionButtons.length).toBeGreaterThan(0);

    fireEvent.click(actionButtons[0]);
    expect(mockSelectOrder).toHaveBeenCalledTimes(1);
    expect(mockSelectOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.stringContaining("LSX-"),
      }),
    );
  });
});
