/**
 * Lập phiếu nhập theo Đơn sản xuất + kiểm đếm theo thùng (docs 03 §4.1 bước 1–5, SCRUM-566) — chữ hiển thị và câu
 * lỗi form.
 */

import { PRODUCTION_RECEIPT_LIMITS } from "./numbers";

export const RECEIPT_COUNT_LABELS = {
  create: {
    button: "Lập phiếu nhập",
    title: "Lập phiếu nhập theo Đơn sản xuất",
    description:
      "Chọn Đơn sản xuất ghi trên phiếu giao của đơn vị sản xuất. Phiếu mở ở trạng thái nháp, kiểm đếm theo thùng ở bước sau.",
    productionOrder: "Đơn sản xuất",
    productionOrderPlaceholder: "Chọn Đơn sản xuất",
    productionOrderSearch: "Tìm theo mã Đơn sản xuất",
    productionOrderEmpty: "Không có Đơn sản xuất nào đang nhận được hàng",
    loading: "Đang tải danh sách Đơn sản xuất…",
    loadError: "Không tải được danh sách Đơn sản xuất — bấm để thử lại",
    optionMeta: (remaining: number, ordered: number) => `còn ${remaining}/${ordered} thùng`,
    deliveryNote: "Số phiếu giao",
    deliveryNotePlaceholder: "Số phiếu giao của đơn vị sản xuất",
    note: "Ghi chú",
    submit: "Lập phiếu",
  },
  // BE chỉ cấp `production-orders:READ` cho quản lý kho trở lên — thiếu quyền thì không chọn / đọc được Đơn sản xuất
  noProductionRead:
    "Cần quyền xem Đơn sản xuất (production-orders:READ) để chọn đơn và lấy dòng cần đếm — liên hệ quản trị.",
  count: {
    title: "Kiểm đếm theo thùng",
    description:
      "Mỗi dòng Đơn sản xuất: chọn khu nhận, liệt kê các thùng đúng số cái chuẩn. Thùng lệch số chuẩn hoặc lỗi thì trả lại đơn vị sản xuất, không nhận. Lô tự gán theo mã Đơn sản xuất.",
    caption: "Kiểm đếm theo dòng Đơn sản xuất",
    headers: {
      sku: "SKU",
      production: "Đơn SX (nhận / đặt)",
      location: "Khu nhận",
      cartons: "Thùng phiếu này",
      result: "Đối chiếu",
    },
    openCartons: (cartons: number) => `còn nhận ${cartons} thùng`,
    perCarton: (units: number) => `${units} cái / thùng`,
    lot: (code: string) => `Lô ${code} (tự gán)`,
    cartonsAndUnits: (cartons: number, units: number) => `${cartons} thùng · ${units} cái`,
    newCartons: "Thùng mới",
    newCartonsAria: (sku: string) => `Số thùng mới của ${sku}`,
    locationAria: (sku: string) => `Khu nhận của ${sku}`,
    locationPlaceholder: "Chọn khu",
    noReceivingArea: "Kho chưa có khu nhận hàng (RECEIVING)",
    noLocationRead:
      "Cần quyền xem vị trí kho (warehouse-locations:READ) để chọn khu nhận hàng — liên hệ quản trị.",
    areasLoadError: "Không tải được danh sách khu nhận hàng của kho",
    removeCarton: (lpn: string) => `Bỏ thùng ${lpn}`,
    restoreCarton: (lpn: string) => `Giữ lại thùng ${lpn}`,
    voidHint: "Thùng gạch ngang sẽ thành Void khi lưu.",
    save: "Lưu kiểm đếm",
    discard: "Bỏ thay đổi",
    dirtyBlocksConfirm: "Còn thay đổi kiểm đếm chưa lưu — lưu trước khi xác nhận",
    loadError: "Không tải được dòng của Đơn sản xuất",
    retry: "Thử lại",
    result: {
      full: "Đủ",
      short: "Thiếu",
      over: "Thừa",
      none: "Chưa đếm",
    },
  },
} as const;

/** Lỗi validate form lập phiếu / kiểm đếm — hiện inline dưới ô. */
export const RECEIPT_COUNT_FIELD_MESSAGES = {
  productionOrderRequired: "Chọn Đơn sản xuất",
  deliveryNoteTooLong: `Tối đa ${PRODUCTION_RECEIPT_LIMITS.deliveryNoteMax} ký tự`,
  noteTooLong: `Tối đa ${PRODUCTION_RECEIPT_LIMITS.noteMax} ký tự`,
  locationRequired: "Chọn khu nhận hàng",
  cartonsInvalid: "Số thùng phải là số nguyên ≥ 0",
  exceedsOpen: (max: number) =>
    `Vượt số thùng còn nhận được (${max}) — trả thùng thừa lại đơn vị sản xuất`,
  lineHadCartons:
    "Dòng đã có thùng dán nhãn không bỏ được — giữ ít nhất một thùng, hoặc huỷ phiếu để đếm lại",
  nothingCounted: "Đếm ít nhất một thùng trước khi lưu",
  tooManyLines: `Tối đa ${PRODUCTION_RECEIPT_LIMITS.linesMax} dòng mỗi phiếu`,
} as const;
