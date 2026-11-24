/**
 * Tên nhóm (tab) của sidebar back-office — chia theo nhóm chức năng và module của docs
 * (docs 00 §3 "Bản đồ module"). Nhóm Sản xuất, Kho, Thanh toán dùng nhãn của feature
 * (`PRODUCTION_LABELS.navGroup`, `UI_LABELS.warehouseMap.workspace.navGroup`, `PAYMENT_LABELS.navGroup`).
 */
export const NAV_GROUP_LABELS = {
  overview: "Tổng quan",
  /** Dữ liệu sản phẩm (docs 01): sản phẩm, thuộc tính, danh mục, hồ sơ hàng tồn (§4.7). */
  product: "Sản phẩm",
  /** Quản lý thiết kế (docs 12): duyệt thiết kế khách gửi, yêu cầu báo giá từ bản thiết kế (§4.8). */
  design: "Thiết kế",
  /** Bán hàng (docs 13, 14, 16, 18): khách, bảng giá nội bộ, báo giá, chat. */
  sales: "Bán hàng",
  /** Quản lý đơn hàng (docs 17): đơn, yêu cầu huỷ, giao thất bại, trả hàng. */
  order: "Đơn hàng",
  /** Nhập kho thành phẩm (docs 03): phiếu theo Đơn sản xuất và phiếu hàng hoàn. */
  receiving: "Nhập kho",
  /** Kiểm soát tồn (docs 20). */
  inventory: "Tồn kho",
  /** Giao hàng (docs 09): ước tính tải, kế hoạch xếp xe, chuyến, hãng vận chuyển. */
  shipping: "Vận chuyển",
  /** Người dùng và phân quyền (docs 00 §2.5). */
  system: "Hệ thống",
} as const;
