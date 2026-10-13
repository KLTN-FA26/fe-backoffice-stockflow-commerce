import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlankIssueScanScreen } from "../components/BlankIssueScanScreen";

describe("BlankIssueScanScreen (SCRUM-410 Barcode Registry & Exact Validation)", () => {
  const mockRefresh = vi.fn();
  const mockNavigateToKanban = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hiển thị thông tin LSX chờ xuất phôi và bàn quét mã vạch", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    expect(screen.getByText(/Quét Xuất Phôi Sản Xuất/i)).toBeInTheDocument();
    expect(screen.getByText(/Chọn Lệnh sản xuất cần xuất phôi/i)).toBeInTheDocument();
    expect(screen.getByText(/Bàn quét mã vạch thùng phôi/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhật ký các lượt quét gần nhất/i)).toBeInTheDocument();
  });

  it("từ chối và báo lỗi khi người dùng bấm xác nhận nhưng chưa quét mã vạch", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Vui lòng quét hoặc nhập mã vạch phôi trên thùng hàng/i),
    ).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("từ chối mã vạch giả mạo chứa substring SKU nhưng không có trong registry (Chống lỗi includes)", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    // Mã này chứa substring "TO-GIAY-750-KRAFT" nhưng là mã bịa, không tồn tại trong registry
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-GIAY-750-KRAFT-FABRICATED" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    // Báo lỗi không tồn tại trong danh mục tem kho (xuất hiện trong banner lỗi và/hoặc nhật ký)
    expect(screen.getAllByText(/LỖI MÃ VẠCH KHÔNG TỒN TẠI/i).length).toBeGreaterThanOrEqual(1);

    // Lịch sử ghi nhận từ chối
    expect(screen.getAllByText("TỪ CHỐI").length).toBeGreaterThanOrEqual(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("từ chối khi quét mã vạch thuộc SKU khác trong kho (Sai chủng loại phôi)", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    // Mã này có thật trong kho nhưng thuộc SKU Ly 500ml, trong khi LSX cần Tô 750ml
    fireEvent.change(barcodeInput, { target: { value: "BC-LY-500-LOT2601-LOC-A01" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    expect(screen.getAllByText(/LỖI SAI CHỦNG LOẠI PHÔI/i).length).toBeGreaterThanOrEqual(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("từ chối khi quét mã vạch của lô phôi đã cạn kiệt (Tồn kho = 0)", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    // Mã này đúng SKU Tô 750ml nhưng lô này tồn = 0 (DEPLETED)
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-DEPLETED-LOT99" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    expect(screen.getAllByText(/LỖI LÔ PHÔI ĐÃ HẾT/i).length).toBeGreaterThanOrEqual(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("từ chối khi số lượng xuất phôi là 0 hoặc số âm", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-LOT2601-LOC-B04" } });

    const qtyInput = screen.getByTestId("qty-input");
    fireEvent.change(qtyInput, { target: { value: "0" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Số lượng xuất phôi phải là số nguyên dương/i)).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("từ chối khi số lượng xuất vượt định mức còn lại (BR-PRD-03: Chống xuất vượt)", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-LOT2601-LOC-B04" } });

    const qtyInput = screen.getByTestId("qty-input");
    fireEvent.change(qtyInput, { target: { value: "999999" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    expect(screen.getAllByText(/BR-PRD-03: Lỗi xuất vượt định mức/i).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("chấp thuận khi quét đúng mã tem hợp lệ, hiển thị thông tin lô, vị trí và lịch sử quét thành công", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    // Quét mã hợp lệ trong registry
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-LOT2601-LOC-B04" } });

    const qtyInput = screen.getByTestId("qty-input");
    fireEvent.change(qtyInput, { target: { value: "500" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    fireEvent.click(submitBtn);

    // Thành công
    expect(screen.getAllByText(/Quét xuất phôi thành công/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/LOT-2026-03-A/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("THÀNH CÔNG").length).toBeGreaterThanOrEqual(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Input được làm sạch sau khi quét thành công
    expect(barcodeInput).toHaveValue("");
  });

  it("cảnh báo và từ chối khi quét lặp quá nhanh trong vòng 2 giây (Rapid scan protection)", () => {
    render(
      <BlankIssueScanScreen onRefresh={mockRefresh} onNavigateToKanban={mockNavigateToKanban} />,
    );

    const barcodeInput = screen.getByTestId("barcode-input");
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-LOT2601-LOC-B04" } });

    const submitBtn = screen.getByRole("button", { name: /Xác nhận quét mã/i });
    // Lần quét 1: Thành công
    fireEvent.click(submitBtn);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Nhập lại ngay lập tức mã vừa quét
    fireEvent.change(barcodeInput, { target: { value: "BC-TO-750-LOT2601-LOC-B04" } });
    fireEvent.click(submitBtn);

    // Lần quét 2: Cảnh báo quét trùng
    expect(
      screen.getByText(
        /Cảnh báo quét trùng: Mã vạch "BC-TO-750-LOT2601-LOC-B04" vừa được quét thành công/i,
      ),
    ).toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalledTimes(1); // Không gọi thêm refresh
  });
});
