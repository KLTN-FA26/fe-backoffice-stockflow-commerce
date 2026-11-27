/**
 * Lập phiếu nhập theo Đơn sản xuất + kiểm đếm theo thùng (docs 03 §4.1 bước 1–5, SCRUM-566) — chữ hiển thị và câu
 * lỗi form.
 */

import { PRODUCTION_RECEIPT_LIMITS } from "./numbers";

export const RECEIPT_COUNT_LABELS = {
  create: {
    button: "Lập phiếu nhập",
    title: "Lập phiếu nhập theo đơn sản xuất",
    description:
      "Chọn đơn sản xuất ghi trên phiếu giao của đơn vị sản xuất. Phiếu mở ở trạng thái nháp, kiểm đếm theo thùng ở bước sau.",
    productionOrder: "Đơn sản xuất",
    productionOrderPlaceholder: "Chọn đơn sản xuất",
    productionOrderSearch: "Tìm theo mã đơn sản xuất",
    productionOrderEmpty: "Không có đơn sản xuất nào đang nhận được hàng",
    loading: "Đang tải danh sách đơn sản xuất…",
    loadError: "Không tải được danh sách đơn sản xuất — bấm để thử lại",
    /** Dòng phụ trong danh sách: đơn vị sản xuất · SKU · thùng còn nhận · ngày giao dự kiến (hoặc ngày cần hàng). */
    optionSub: (parts: {
      producer: string | null | undefined;
      skus: readonly string[];
      remaining: number;
      ordered: number;
      expected: string | null | undefined;
      needBy: string | null | undefined;
    }) =>
      [
        parts.producer,
        parts.skus.length > 3
          ? `${parts.skus.slice(0, 3).join(", ")} +${parts.skus.length - 3}`
          : parts.skus.join(", "),
        `còn ${parts.remaining}/${parts.ordered} thùng`,
        parts.expected
          ? `giao dự kiến ${parts.expected}`
          : parts.needBy
            ? `cần hàng ${parts.needBy}`
            : null,
      ]
        .filter(Boolean)
        .join(" · "),
    retry: "Thử lại",
    deliveryNote: "Số phiếu giao",
    deliveryNotePlaceholder: "Số phiếu giao của đơn vị sản xuất",
    note: "Ghi chú",
    submit: "Lập phiếu",
  },
  // BE chỉ cấp `production-orders:READ` cho quản lý kho trở lên — thiếu quyền thì không chọn / đọc được Đơn sản xuất
  noProductionRead:
    "Tài khoản chưa được xem đơn sản xuất nên chưa chọn được đơn và lấy dòng cần đếm — liên hệ quản trị để được cấp quyền.",
  count: {
    title: "Kiểm đếm theo thùng",
    description:
      "Chọn khu nhận và liệt kê các thùng đúng số cái chuẩn của từng dòng. Thùng lệch số chuẩn hoặc lỗi thì trả lại đơn vị sản xuất.",
    caption: "Kiểm đếm theo dòng đơn sản xuất",
    headers: {
      sku: "SKU",
      production: "Đã nhận / đặt (thùng)",
      location: "Khu nhận",
      cartons: "Thùng phiếu này",
      result: "Đối chiếu",
    },
    openCartons: (cartons: number) => `còn nhận ${cartons} thùng`,
    /** Số thùng đã nhận / đặt của dòng Đơn sản xuất — có đơn vị (S12-4). */
    receivedOfOrdered: (received: number, ordered: number) =>
      `Đã nhận ${received}/${ordered} thùng`,
    /** Thùng đã đếm trong phiếu này của dòng: "Đã đếm 10/10 thùng". */
    countedOfOpen: (counted: number, open: number) => `Đã đếm ${counted}/${open} thùng`,
    // Một khu nhận cho cả phiếu (sửa riêng từng dòng khi cần)
    allLocation: "Khu nhận cho cả phiếu",
    allLocationPlaceholder: "Chọn khu cho mọi dòng",
    allLocationMixed: "Mỗi dòng một khu",
    allLocationHint: "Áp cho mọi dòng; sửa riêng từng dòng ở cột Khu nhận.",
    perCarton: (units: number) => `${units} cái / thùng`,
    lot: (code: string) => `Lô ${code} (tự gán)`,
    cartonsAndUnits: (cartons: number, units: number) => `${cartons} thùng · ${units} cái`,
    unitsOnly: (units: number) => `${units} cái`,
    newCartons: "Thêm thùng mới",
    existingCartons: (count: number) => `Đã có ${count} thùng — nhập số thùng thêm`,
    newCartonsAria: (sku: string) => `Số thùng mới của ${sku}`,
    locationAria: (sku: string) => `Khu nhận của ${sku}`,
    locationPlaceholder: "Chọn khu",
    noReceivingArea: "Kho chưa có khu nhận hàng (RECEIVING)",
    noLocationRead:
      "Tài khoản chưa được xem vị trí kho nên chưa chọn được khu nhận hàng — liên hệ quản trị để được cấp quyền.",
    areasLoadError: "Không tải được danh sách khu nhận hàng của kho",
    removeCarton: (lpn: string) => `Bỏ thùng ${lpn}`,
    restoreCarton: (lpn: string) => `Giữ lại thùng ${lpn}`,
    voidHint: "Thùng gạch ngang sẽ thành Void khi lưu.",
    save: "Lưu kiểm đếm",
    discard: "Bỏ thay đổi",
    dirtyBlocksConfirm: "Còn thay đổi kiểm đếm chưa lưu — lưu trước khi xác nhận",
    loadError: "Không tải được dòng của đơn sản xuất",
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
  productionOrderRequired: "Chọn đơn sản xuất",
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
