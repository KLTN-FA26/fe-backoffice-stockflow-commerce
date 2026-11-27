/**
 * Màn Nhận hàng trong tab theo kho (docs 03 §2: NV kho kiểm đếm, quét thùng hàng hoàn, xác nhận — trong phạm vi kho
 * được gán). Danh sách chứng từ nhiều kho vẫn ở nhóm "Nhập kho".
 */
export const RECEIVING_LABELS = {
  title: "Nhận hàng",
  /** Lọc trạng thái chọn một trên toolbar (`?tab=`): mặc định chỉ phiếu đang nhận (DRAFT). */
  tabs: { draft: "Đang nhận", all: "Tất cả" },
  summaryStatus: "Trạng thái",
  noun: "phiếu nhận",
  emptyDraftTitle: "Kho chưa có phiếu đang nhận",
  emptyAllTitle: "Kho chưa có phiếu nhận",
  emptyDescription:
    "Hàng về từ đơn vị sản xuất thì lập phiếu nhập theo đơn sản xuất; phiếu hàng hoàn được lập ở nhóm Nhập kho.",
} as const;
