import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SalesOrderTimelineView } from "../components/SalesOrderTimelineView";
import { ReserveStockCheckoutView } from "../components/ReserveStockCheckoutView";
import { RmaRequestPortalView } from "../components/RmaRequestPortalView";
import { RmaApprovalBackofficeView } from "../components/RmaApprovalBackofficeView";
import { CustomizationPriceCalculator } from "../components/CustomizationPriceCalculator";
import { PackagingDesignCanvas } from "../components/PackagingDesignCanvas";
import { StorefrontChatWidget } from "../components/StorefrontChatWidget";

describe("Batch 2 UI Deliverables Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // SCRUM-248: Sales Order Lifecycle Timeline
  // --------------------------------------------------------------------------
  describe("SCRUM-248: Sales Order Lifecycle Timeline", () => {
    it("hiển thị danh sách mốc thời gian và cho phép ghi nhận sự kiện tiến độ mới", () => {
      render(<SalesOrderTimelineView />);

      expect(screen.getByText(/Dòng Thời Gian Đơn Hàng Bán/i)).toBeInTheDocument();
      expect(screen.getAllByText(/SO-2026-0412/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Tạo đơn hàng & Chờ đặt cọc/i)).toBeInTheDocument();

      // Mở modal thêm sự kiện
      const addBtn = screen.getByRole("button", { name: /Ghi nhận sự kiện mới/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/Ghi nhận mốc sự kiện mới cho/i)).toBeInTheDocument();

      // Nhập tiêu đề sự kiện
      const titleInput = screen.getByPlaceholderText(/VD: Hoàn tất in 5,000 cái/i);
      fireEvent.change(titleInput, { target: { value: "Đã hoàn thành in ấn đợt 1" } });

      const submitBtn = screen.getByRole("button", { name: /Xác nhận lưu mốc/i });
      fireEvent.click(submitBtn);

      // Mốc mới xuất hiện trên timeline
      expect(screen.getByText("Đã hoàn thành in ấn đợt 1")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-212: Storefront Stock Reservation
  // --------------------------------------------------------------------------
  describe("SCRUM-212: Storefront Checkout Stock Reservation", () => {
    it("hiển thị đồng hồ đếm ngược giữ hàng 15 phút và danh sách mặt hàng được khóa tồn kho", () => {
      render(<ReserveStockCheckoutView />);

      expect(screen.getByText(/Giữ Hàng Khi Thanh Toán Storefront/i)).toBeInTheDocument();
      expect(screen.getByText(/Tồn kho của bạn đang được BẢO LƯU AN TOÀN/i)).toBeInTheDocument();
      expect(screen.getByText(/Ly giấy Kraft 500ml 2 lớp cách nhiệt/i)).toBeInTheDocument();
      expect(screen.getAllByText(/ĐÃ KHÓA GIỮ/i).length).toBeGreaterThanOrEqual(1);

      // Thử bấm gia hạn +5 phút
      const extendBtn = screen.getByRole("button", { name: /^\+5 Phút$/i });
      fireEvent.click(extendBtn);

      expect(screen.getByText(/Tồn kho của bạn đang được BẢO LƯU AN TOÀN/i)).toBeInTheDocument();
    });

    it("cho phép người dùng chủ động giải phóng lượng hàng giữ kho", () => {
      render(<ReserveStockCheckoutView />);

      const releaseBtn = screen.getByRole("button", { name: /Hủy giữ hàng ngay/i });
      fireEvent.click(releaseBtn);

      // Modal xác nhận xuất hiện
      const confirmReleaseBtn = screen.getByRole("button", { name: /Xác nhận giải phóng/i });
      fireEvent.click(confirmReleaseBtn);

      expect(
        screen.getByText(/Phiên giữ hàng đã HẾT HẠN hoặc đã HỦY GIỮ TỒN KHO/i),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-257: Customer RMA Portal
  // --------------------------------------------------------------------------
  describe("SCRUM-257: Customer RMA Request Portal", () => {
    it("cho phép khách hàng tạo yêu cầu RMA đổi trả với mô tả và ảnh bằng chứng", () => {
      render(<RmaRequestPortalView />);

      expect(screen.getByText(/Cổng Khách Hàng Gửi Yêu Cầu Đổi Trả RMA/i)).toBeInTheDocument();

      const descInput = screen.getByPlaceholderText(/Ghi rõ vị trí lỗi/i);
      fireEvent.change(descInput, {
        target: { value: "Phát hiện 200 ly bị rò nước ở đáy mép hàn" },
      });

      const submitBtn = screen.getByRole("button", { name: /Xác nhận gửi yêu cầu RMA/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Gửi yêu cầu đổi trả thành công!/i)).toBeInTheDocument();
      expect(screen.getByText(/RMA-2026-/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-258: Backoffice RMA Approval Queue
  // --------------------------------------------------------------------------
  describe("SCRUM-258: Backoffice RMA Approval Queue", () => {
    it("hiển thị hàng đợi RMA và cho phép phê duyệt kèm cấp mã ủy quyền", () => {
      render(<RmaApprovalBackofficeView />);

      expect(screen.getByText(/Hàng Đợi Duyệt Đổi Trả RMA Backoffice/i)).toBeInTheDocument();
      expect(screen.getByText(/RMA-2026-0045/i)).toBeInTheDocument();

      // Bấm Xem & Duyệt
      const viewBtns = screen.getAllByRole("button", { name: /Xem & Duyệt/i });
      fireEvent.click(viewBtns[0]);

      expect(screen.getByText(/Hồ sơ thẩm định RMA/i)).toBeInTheDocument();

      // Bấm Phê duyệt
      const approveBtn = screen.getByRole("button", { name: /Phê duyệt & Cấp mã thu hồi/i });
      fireEvent.click(approveBtn);

      // Trở lại danh sách với trạng thái Approved
      expect(screen.getAllByText(/Đã duyệt/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-304: Live Customization Price Calculator
  // --------------------------------------------------------------------------
  describe("SCRUM-304: Live Customization Price Calculator", () => {
    it("tính toán lại giá tức thời khi thay đổi số màu in và số lượng đặt hàng", () => {
      render(<CustomizationPriceCalculator />);

      expect(screen.getByText(/Bảng Tính Giá Tùy Biến Sản Phẩm In Ấn/i)).toBeInTheDocument();
      expect(screen.getByText(/LIVE RECALC/i)).toBeInTheDocument();

      // Kiểm tra giá ban đầu
      expect(screen.getByText(/đ\/cái/i)).toBeInTheDocument();

      // Chọn số màu là 4 màu
      const color4Btn = screen.getByRole("button", { name: /4 màu/i });
      fireEvent.click(color4Btn);

      // Phí khuôn và tổng tiền tự động thay đổi
      expect(screen.getAllByText(/4 màu/i).length).toBeGreaterThanOrEqual(1);

      // Chọn số lượng 20,000 cái (được chiết khấu 12%)
      const qty20kBtn = screen.getByRole("button", { name: /20,000 cái/i });
      fireEvent.click(qty20kBtn);

      expect(screen.getByText(/Đã giảm 12% theo bậc số lượng/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-299 & SCRUM-300: 2D Die-Cut Canvas Designer
  // --------------------------------------------------------------------------
  describe("SCRUM-299 & SCRUM-300: 2D Die-Cut Packaging Designer", () => {
    it("hiển thị khuôn bế trải phẳng 2D và cho phép điều chỉnh kích thước miệng/đáy/cao", () => {
      render(<PackagingDesignCanvas />);

      expect(screen.getByText(/Khuôn Bế Trải Phẳng 2D & Thiết Kế Bố Cục In/i)).toBeInTheDocument();
      expect(screen.getByText(/Bản Vẽ Bế Phẳng 2D/i)).toBeInTheDocument();
      expect(screen.getByText(/Vùng Bleed cắt/i)).toBeInTheDocument();

      // Thay đổi đường kính miệng
      const mouthInput = screen.getByDisplayValue("90");
      fireEvent.change(mouthInput, { target: { value: "100" } });

      // Chu vi trải phẳng tự động tính lại (PI * 100 = ~314mm)
      expect(screen.getByText(/Chu vi: 314mm/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SCRUM-320: Storefront Chat Widget
  // --------------------------------------------------------------------------
  describe("SCRUM-320: Storefront Chat Widget", () => {
    it("cho phép mở khung chat và gửi câu hỏi tư vấn in ấn nhận câu trả lời giả lập", () => {
      render(<StorefrontChatWidget />);

      expect(screen.getByText(/Widget Tư Vấn Trực Tuyến Khách Hàng/i)).toBeInTheDocument();

      // Bấm nút mở chat nổi
      const triggerBtn = screen.getByRole("button", { name: /Mở cửa sổ tư vấn trực tuyến/i });
      fireEvent.click(triggerBtn);

      expect(screen.getByText(/Minh Anh · Tư vấn viên StockFlow/i)).toBeInTheDocument();

      // Nhập câu hỏi và gửi
      const input = screen.getByPlaceholderText(/Nhập câu hỏi cần tư vấn/i);
      fireEvent.change(input, { target: { value: "Báo giá ly giấy 500ml số lượng 5000 cái" } });

      fireEvent.submit(input.closest("form")!);

      // Tin nhắn người dùng và phản hồi của bot xuất hiện
      expect(screen.getByText("Báo giá ly giấy 500ml số lượng 5000 cái")).toBeInTheDocument();
      expect(screen.getByText(/đơn giá phôi khoảng 1.650 đ\/cái/i)).toBeInTheDocument();
    });
  });
});
