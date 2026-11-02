/**
 * Nhận hàng theo thùng có LPN (BE SCRUM-473 #197, FE SCRUM-494 / issue #104) — chữ hiển thị, câu lỗi, khổ nhãn.
 */

import { RECEIPT_CARTON_LIMITS } from "./numbers";

/** Khổ nhãn — BE `common.label.LabelFormat`. */
export const CARTON_LABEL_FORMATS = ["A4_SHEET", "THERMAL_ROLL"] as const;
export type CartonLabelFormat = (typeof CARTON_LABEL_FORMATS)[number];

export const CARTON_LABEL_FORMAT_LABELS = {
  A4_SHEET: "Tờ A4 — 24 nhãn 70×37 mm",
  THERMAL_ROLL: "Cuộn nhiệt — nhãn 60×40 mm",
} as const satisfies Record<CartonLabelFormat, string>;

/** Lỗi validate form chia thùng (zod Input) — hiện inline dưới ô. */
export const RECEIPT_CARTON_FIELD_MESSAGES = {
  unitRequired: "Chọn đơn vị thùng",
  cartonQuantity: "SL trong thùng phải là số nguyên ≥ 1",
  cartonsExceedLine: "Các thùng chứa nhiều hơn SL nhận của dòng",
  duplicateLpn: "LPN này đã có ở thùng khác của dòng",
  cartonsTooMany: `Tối đa ${RECEIPT_CARTON_LIMITS.cartonsPerLineMax} thùng mỗi dòng`,
  qcLooseSum: (loose: number) =>
    `Đạt + Cách ly + Không đạt của hàng lẻ phải bằng SL lẻ ${loose} (thùng tính nguyên thùng)`,
} as const;

/**
 * Mã lỗi BE khi lưu kiểm đếm có thùng / in nhãn / QC theo thùng → câu tiếng Việt (gộp vào `RECEIPT_ERROR_MESSAGES`).
 * `RECEIPT_PACKAGES_EXCEED_LINE` / `RECEIPT_LINE_HAS_PACKAGES` ở ngữ cảnh duyệt phiếu dùng
 * `RECEIPT_DECISION_ERROR_MESSAGES`.
 */
export const RECEIPT_CARTON_ERROR_MESSAGES = {
  RECEIPT_PACKAGES_EXCEED_LINE: "Các thùng chứa nhiều hơn số lượng nhận của dòng",
  RECEIPT_LINE_HAS_PACKAGES:
    "Dòng đã từng có thùng dán nhãn: giữ nguyên dòng PO và số lô, không bỏ khỏi phiếu được, và chỉ đổi đơn vị khi bỏ hết thùng cũ. Muốn sửa lô — huỷ phiếu rồi đếm lại",
  RECEIPT_LINE_UNIT_INVALID:
    "Đơn vị không hợp lệ cho thùng: thùng phải theo một đơn vị đóng gói đang dùng; dòng không có thùng thì đếm theo đơn vị cơ sở",
  UOM_CONVERSION_NOT_FOUND: "Mặt hàng không có đơn vị này",
  RECEIPT_PACKAGES_NOT_SUPPORTED: "Phiếu nhận hàng gia công không chia thùng — hãy đếm hàng lẻ",
  STOCK_PACKAGE_NOT_FOUND:
    "Không tìm thấy thùng này trên dòng (có thể đã bị thay đổi ở nơi khác). Dữ liệu đã được tải lại.",
  INVALID_STOCK_PACKAGE_TRANSITION:
    "Thùng không còn ở trạng thái cho phép thao tác này (đã huỷ, đã dùng hết hoặc thất lạc). Dữ liệu đã được tải lại.",
  STOCK_PACKAGE_WRONG_LOCATION:
    "Thùng không còn nằm ở khu QC của dòng — kiểm tra lại vị trí thùng. Dữ liệu đã được tải lại.",
  STOCK_PACKAGE_LABELS_EMPTY: "Không có thùng nào để in nhãn",
  STOCK_PACKAGE_LABELS_TOO_MANY: `Mỗi lần in tối đa ${RECEIPT_CARTON_LIMITS.labelsMax} nhãn thùng`,
} as const;

/**
 * Lỗi theo ô do BE trả mã chung (`VALIDATION_FAILED`) — BE ghi câu tiếng Anh trong `fieldErrors[].message`, FE thay
 * bằng câu tiếng Việt theo đường dẫn ô (`GoodsReceiptServiceImpl#cartonUnit`).
 */
export const RECEIPT_CARTON_VALIDATION_MESSAGES = {
  unitOfMeasure: RECEIPT_CARTON_FIELD_MESSAGES.unitRequired,
  quantity: RECEIPT_CARTON_FIELD_MESSAGES.cartonQuantity,
  lpn: "LPN bị liệt kê hai lần — mỗi thùng chỉ một dòng",
} as const;

/** Chữ hiển thị của màn chia thùng / bảng thùng / in nhãn / QC theo thùng. */
export const RECEIPT_CARTON_LABELS = {
  cartons: "Thùng",
  newCarton: "Mới",
  loose: "Lẻ",
  unit: "Đơn vị thùng",
  splitAction: "Chia thùng",
  hideCartons: "Thu gọn",
  saveFirst: "Lưu kiểm đếm để chia thùng",
  noPackingUnit: "Mặt hàng chưa có đơn vị đóng gói",
  addCartons: "Thêm",
  addCount: (lineNo: number) => `Số thùng thêm dòng ${lineNo}`,
  newCartonLabel: (n: number) => `mới ${n}`,
  cartonsOf: (factor: number) => `thùng × ${factor}`,
  removeCarton: (lpn: string) => `Xoá thùng ${lpn}`,
  removeNewCarton: (label: string) => `Xoá thùng ${label}`,
  cartonQuantity: (label: string) => `SL thùng ${label}`,
  vsNominal: (diff: number) => (diff === 0 ? "đủ" : diff > 0 ? `dư ${diff}` : `thiếu ${-diff}`),
  summary: (cartons: number, units: number, loose: number) =>
    `${cartons} thùng · ${units} đơn vị · hàng lẻ ${loose}`,
  cellSummary: (cartons: number, loose: number) => `${cartons} thùng · lẻ ${loose}`,
  lockedHint:
    "Sau khi lưu, các thùng được cấp LPN và dòng này giữ nguyên dòng PO và số lô — muốn sửa lô phải huỷ phiếu và đếm lại. Kiểm tra lô trước khi in nhãn.",
  lotLocked: "Dòng đã có thùng — không đổi được số lô",
  skuLocked: "Dòng đã có thùng — không đổi được SKU",
  removeLineLocked: "Dòng đã có thùng — không bỏ khỏi phiếu được",
  unitLocked: "Bỏ hết thùng đã có LPN trước khi đổi đơn vị",
  confirmRemoveTitle: "Huỷ thùng đã dán nhãn?",
  confirmRemoveDescription: (lpn: string) =>
    `Thùng ${lpn} sẽ bị huỷ khi lưu kiểm đếm — nhãn đã in không còn hiệu lực.`,
  confirmRemoveAction: "Huỷ thùng",
  // Bảng dòng nhận + panel thùng của dòng
  column: "Thùng / Lẻ",
  openCartons: (sku: string) => `Xem thùng của ${sku}`,
  panelSubtitle: (cartons: number, loose: number, unit: string | null) =>
    `${cartons} thùng · lẻ ${loose}${unit ? ` · đơn vị ${unit}` : ""}`,
  headers: {
    lpn: "LPN",
    received: "Đếm được",
    now: "Hiện còn",
    nominal: "Danh nghĩa",
    status: "Trạng thái",
    location: "Vị trí",
  },
  selectCarton: (lpn: string) => `Chọn thùng ${lpn} để in lại`,
  printLine: "In nhãn cả dòng",
  reprint: (count: number) => `In lại ${count} nhãn`,
  // Dialog kết luận QC theo nguyên thùng
  qcCartonsTitle: "Thùng — kết luận nguyên thùng, không mở thùng",
  qcChoice: (outcome: string, lpn: string) => `${outcome} thùng ${lpn}`,
  qcCartonAway: (location: string) => `Đang ở ${location}, không ở khu QC — tính là Đạt`,
  qcLooseAccepted: "Đạt (lẻ)",
  qcOutcome: { ACCEPTED: "Đạt", QUARANTINE: "Cách ly", REJECTED: "Không đạt" },
  qcLooseTitle: (loose: number) => `Hàng lẻ: ${loose}`,
  qcPartQuantity: (part: string, loose: boolean) => (loose ? `SL lẻ ${part}` : `SL ${part}`),
  qcPartLocation: (part: string) => `Khu ${part}`,
  qcPartReason: (part: string) => `Lý do ${part}`,
  qcPartHint: {
    quarantined: "Chờ kết luận lại — vào khu QUARANTINE",
    rejected: "Trả NCC — vào khu QUARANTINE, tồn Blocked",
  },
  qcFields: { quantity: "SL", location: "Khu", reason: "Lý do" },
  qcTotal: (total: number, moved: number) => `Tổng: ${total} / ${moved}`,
} as const;

/** Dialog in nhãn thùng (BE trả PDF — xem trước rồi in / tải xuống). */
export const CARTON_PRINT_LABELS = {
  title: "In nhãn thùng",
  lineDescription: (count: number) =>
    `Nhãn cho ${count} thùng còn hiệu lực của dòng: LPN (chữ, QR, Code 128), SKU và SL đếm được / danh nghĩa.`,
  reprintDescription: (lpns: string) => `In lại nhãn: ${lpns}`,
  format: "Khổ nhãn",
  generate: "Tạo file in",
  regenerate: "Tạo lại",
  printNow: "In",
  download: "Tải xuống",
  preview: "Xem trước nhãn thùng",
  close: "Đóng",
} as const;
