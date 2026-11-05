/**
 * Nhãn, thông báo và lỗi của trạm đóng gói LỆNH CHUYỂN KHO (SCRUM-287 PR F9, BE PR #164 `TransferPackController`).
 * Dùng lại phần lớn nhãn của trạm đóng gói đơn (`UI_LABELS.packing`); ở đây chỉ có nhãn riêng của chuyển kho: dòng của
 * lệnh, đóng bộ (kit), giao nguyên thùng (LPN) và hoàn tất có ghi chú.
 * `UI_LABELS.transferPack` / `TOAST_MESSAGES.transferPack` trỏ về đây.
 */

import { PACKING_ERROR_MESSAGES } from "./labels-packing";
import { TRANSFER_PACK_LIMITS } from "./numbers";

export const TRANSFER_PACK_UI_LABELS = {
  stationTitle: "Đóng gói chuyển kho",
  subtitle:
    "Quét kiểm hàng của lệnh vào kiện, đóng bộ, cân đo niêm phong rồi hoàn tất để lập kế hoạch xe (nguyên chuyến).",
  noAccessTitle: "Bạn không có quyền xem đóng gói chuyển kho",
  noAccessDescription:
    "Cần quyền xem kiện (fulfillment-packages:READ). Liên hệ quản lý kho để được cấp.",
  notFoundTitle: "Không tìm thấy phiên đóng gói",
  notFoundDescription: "Phiên không tồn tại, đã bị huỷ, hoặc nằm ngoài kho bạn phụ trách.",
  loadFailedTitle: "Không tải được phiên đóng gói chuyển kho",
  backToTransfer: "Về lệnh chuyển kho",
  openTransfer: "Mở lệnh chuyển kho",
  start: {
    title: "Bắt đầu đóng gói chuyển kho",
    description:
      "Mở phiên đóng gói của lệnh tại kho nguồn. Lệnh Đã duyệt sẽ chuyển sang Đang lấy hàng; phiên đã mở sẵn thì được mở lại như cũ.",
    action: "Mở phiên đóng gói",
    opening: "Đang mở phiên…",
    noPermission:
      "Bạn chưa được cấp quyền đóng gói (fulfillment-packing:UPDATE) nên chưa mở được phiên.",
    /** Tra phiên hiện hành của lệnh (không mở gì) — chưa từng đóng gói. */
    lookingUp: "Đang tìm phiên đóng gói của lệnh…",
    noneYet: "Lệnh này chưa có phiên đóng gói.",
    noneYetReadOnly:
      "Lệnh này chưa có phiên đóng gói. Bạn chỉ có quyền xem nên chưa mở được phiên — nhờ nhân viên có quyền đóng gói (fulfillment-packing:UPDATE).",
  },
  status: {
    pack: "Phiên đóng gói",
    transfer: "Lệnh chuyển kho",
    deliveryMode: "Hình thức giao",
    owner: "Người đóng",
    waiting: "Chưa có",
    you: "Bạn",
    startedAt: "Bắt đầu lúc",
    packedAt: "Hoàn tất lúc",
    from: "Kho nguồn",
    to: "Kho đích",
  },
  action: {
    complete: "Hoàn tất đóng gói",
    openKit: "Đóng bộ",
    shipCarton: "Giao nguyên thùng",
    planVehicle: "Lập kế hoạch xe",
    reopen: "Mở lại kiện",
    label: "In nhãn",
  },
  notice: {
    packedTitle: "Đã đóng gói xong",
    packedHint:
      "Lệnh đã sẵn sàng để lập kế hoạch xe. Hàng chỉ rời kho khi xe cuối cùng của kế hoạch được bàn giao.",
    cancelled:
      "Phiên đã bị huỷ vì lệnh dừng lấy hàng — mở lại phiên từ lệnh chuyển kho để đóng lại.",
    viewOnly: "Bạn chỉ có quyền xem phiên đóng gói này.",
    takenByOther: (name: string) => `${name} đang đóng gói lệnh này — bạn chỉ xem được.`,
    takenByOtherNoName: "Người khác đang đóng gói lệnh này — bạn chỉ xem được.",
    managerAssist: "Bạn đang thao tác hộ người đóng gói khác (quyền quản lý kho).",
    refetchFailed: "Không tải lại được phiên — đang hiện bản đã tải trước đó.",
    voidedPackages: (codes: string) => `Kiện đã huỷ: ${codes}`,
    kitSuggested:
      "Hàng này đi nhiều thùng mới đủ một đơn vị: nên bấm Đóng bộ. Đóng kiện thường thì phải nêu lý do khi niêm phong.",
  },
  lines: {
    title: "Dòng hàng của lệnh",
    description: "Số cần chuyển, đã đóng vào kiện và còn lại của từng dòng lệnh.",
    sku: "SKU",
    barcode: "Mã vạch",
    lot: "Lô",
    requested: "Yêu cầu",
    packed: "Đã đóng",
    remaining: "Còn lại",
    boxesPerUnit: "Thùng / đơn vị",
    done: "Đủ",
    kitSuggested: "Nên đóng bộ",
    openKit: "Đóng bộ cho dòng này",
  },
  scan: {
    title: "Quét kiểm vào kiện",
    noOpenPackage: "Chưa có kiện đang mở — mở kiện hoặc đóng bộ trước khi quét.",
    targetPackage: "Kiện nhận hàng",
    pickLineTitle: "Chọn dòng của lệnh",
    pickLineDescription:
      "Mã này nằm trên nhiều dòng của lệnh (cùng SKU khác lô). Chọn đúng dòng rồi gửi lại lần quét.",
    pickLineLabel: "Dòng",
    pickLineOption: (lineNo: number, sku: string, lot: string | null | undefined) =>
      `Dòng ${lineNo} · ${sku}${lot ? ` · lô ${lot}` : ""}`,
    pickLineSubmit: "Quét vào dòng này",
    lineRequired: "Chọn dòng của lệnh.",
  },
  packages: {
    title: "Kiện",
    description:
      "Mở kiện, quét hàng vào kiện, cân đo rồi niêm phong. Kiện của một bộ phải niêm phong đủ các phần.",
    empty: "Chưa có kiện nào — mở kiện, đóng bộ hoặc giao nguyên thùng để bắt đầu.",
    kitPart: (no: number, count: number) => `Bộ · phần ${no}/${count}`,
    kitPartHolds: "Phần 1 chứa hàng của bộ",
    asIs: "Nguyên thùng",
    asIsHint:
      "Thùng chưa mở giao nguyên: kích thước và khối lượng đã điền sẵn theo đơn vị đóng gói, hãy cân đo lại.",
    kitReason: "Lý do đóng kiện thường",
    /** BE ghi sẵn lý do tiếng Anh cho kiện nguyên thùng (`TransferPackService.CARTON_AS_IS`) — hiện bằng tiếng Việt. */
    cartonAsIsReason: "Thùng nguyên chưa mở, gửi nguyên trạng",
    removeKit: "Huỷ cả bộ",
    labelOutdated: "Cần in lại nhãn",
    labelOutdatedTitle:
      "Nhãn đã in không còn khớp kiện (đổi số kiện n/N hoặc kiện đã đổi) — in lại nhãn trước khi quét lên xe.",
    reopenTitle: "Mở lại kiện đã niêm phong?",
    reopenDescription: (no: number) =>
      `Kiện ${no} trở lại đang mở để thêm / bớt hàng; phải cân, đo và niêm phong lại, nhãn đã in coi như cũ. Chỉ làm được khi phiên chưa hoàn tất.`,
  },
  label: {
    title: (no: number) => `Nhãn kiện ${no}`,
    transfer: "Lệnh chuyển kho",
    from: "Từ kho",
    to: "Đến kho (người nhận)",
    outdatedFixed: "Nhãn này đã cũ và vừa được làm mới khi in — dán nhãn mới lên kiện.",
    noCod: "Không thu hộ",
  },
  kit: {
    title: "Đóng bộ",
    description:
      "Mở các kiện của một bộ cho MỘT đơn vị của dòng hàng đi nhiều thùng. Quét đơn vị đó vào phần 1, rồi niêm phong mọi phần.",
    line: "Dòng hàng",
    linePlaceholder: "Chọn dòng",
    partCount: "Số phần (để trống = theo danh mục)",
    partCountHint: `Từ 2 đến ${TRANSFER_PACK_LIMITS.kitPartsMax}.`,
    submit: "Mở các kiện của bộ",
    noKitLines: "Không có dòng nào đang cần đóng bộ.",
  },
  carton: {
    title: "Giao nguyên thùng",
    description:
      "Thùng tồn kho chưa mở có thể đi nguyên: quét nhãn LPN, kiểm tra kích thước và khối lượng gợi ý theo đơn vị đóng gói, sửa theo thực tế rồi niêm phong.",
    lpn: "Mã LPN của thùng",
    lpnPlaceholder: "Quét hoặc nhập mã LPN",
    submit: "Mở kiện nguyên thùng",
    opening: "Đang tìm thùng…",
    confirmTitle: "Xác nhận kích thước và khối lượng",
    confirmDescription: (lpn: string, unit: string | null | undefined) =>
      `Thùng ${lpn}${unit ? ` (${unit})` : ""}: số liệu dưới đây gợi ý từ đơn vị đóng gói — cân và đo lại rồi xác nhận để niêm phong.`,
    noSuggestion: "Đơn vị đóng gói chưa khai kích thước hoặc khối lượng — hãy cân đo thùng.",
    confirm: "Xác nhận và niêm phong",
    later: "Để sau",
  },
  complete: {
    title: "Hoàn tất đóng gói chuyển kho",
    description:
      "Mọi kiện phải đã niêm phong (bộ phải đủ phần). Lệnh sẵn sàng để lập kế hoạch xe; hàng chưa rời kho cho tới khi xe cuối được bàn giao.",
    full: "Đã đóng đủ số lượng yêu cầu",
    fullHint: "Mọi dòng của lệnh đã đóng đủ.",
    partial: "Chỉ chuyển phần đã đóng",
    partialHint: "Lệnh chỉ chuyển số lượng đã đóng — bắt buộc ghi lý do.",
    note: "Lý do chuyển thiếu",
    notePlaceholder: "Ví dụ: hết hàng ở lô, hỏng khi đóng…",
    submit: "Hoàn tất",
    notReadyOpen: "Còn kiện đang mở có hàng — niêm phong hoặc huỷ trước.",
    notReadyNone: "Chưa có kiện nào đã niêm phong.",
    missingTitle: "Dòng chưa đóng đủ",
    missingLine: (sku: string, remaining: number) => `${sku}: còn ${remaining}`,
  },
} as const;

export const TRANSFER_PACK_TOAST_MESSAGES = {
  opened: "Đã mở phiên đóng gói chuyển kho",
  packageOpened: "Đã mở kiện mới",
  kitOpened: "Đã mở các kiện của bộ",
  sealed: "Đã niêm phong kiện",
  reopened: "Đã mở lại kiện — cân, đo và niêm phong lại",
  voided: "Đã huỷ kiện",
  cartonOpened: "Đã mở kiện nguyên thùng — kiểm tra kích thước và khối lượng rồi niêm phong",
  completed: "Đã đóng gói xong — lệnh sẵn sàng lập kế hoạch xe",
  completedPartial: "Đã đóng gói xong phần đã đóng — lệnh chỉ chuyển số lượng này",
} as const;

export const TRANSFER_PACK_FIELD_MESSAGES = {
  lpnRequired: "Nhập hoặc quét mã LPN.",
  lpnTooLong: `Mã LPN tối đa ${TRANSFER_PACK_LIMITS.lpnMax} ký tự.`,
  partCountRange: `Số phần từ 2 đến ${TRANSFER_PACK_LIMITS.kitPartsMax}.`,
  lineRequired: "Chọn dòng hàng.",
  noteRequired: "Nhập lý do chuyển thiếu.",
  noteTooLong: `Lý do tối đa ${TRANSFER_PACK_LIMITS.noteMax} ký tự.`,
  kitReasonTooLong: `Lý do tối đa ${TRANSFER_PACK_LIMITS.kitReasonMax} ký tự.`,
} as const;

/**
 * Lỗi BE của `TransferPackController` → câu tiếng Việt. Mã dùng chung với trạm đóng gói đơn lấy câu ở
 * `PACKING_ERROR_MESSAGES` nhưng đổi chữ "đơn" thành "lệnh" khi cần; mã riêng của chuyển kho nằm ở đây.
 */
export const TRANSFER_PACK_ERROR_MESSAGES = {
  ...PACKING_ERROR_MESSAGES,
  NOT_FOUND:
    "Không tìm thấy phiên đóng gói hoặc thùng hàng này (kiểm tra mã LPN). Dữ liệu đã được tải lại.",
  TRANSFER_ORDER_NOT_FOUND: "Không tìm thấy lệnh chuyển kho.",
  TRANSFER_NOT_FULL_TRUCKLOAD:
    "Lệnh này giao lẻ, không đóng gói để lập kế hoạch xe. Đổi hình thức giao sang Nguyên xe (FTL) khi lệnh còn Nháp.",
  INVALID_TRANSFER_TRANSITION:
    "Lệnh chuyển kho chỉ được đóng gói khi Đã duyệt hoặc Đang lấy hàng. Trạng thái lệnh đã đổi — tải lại rồi thử lại.",
  PACKING_TAKEN: "Lệnh này đang được nhân viên khác đóng gói.",
  PACK_STATE_CONFLICT:
    "Phiên đóng gói đã đổi (đã hoàn tất hoặc bị huỷ) nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  PACK_ITEM_NOT_IN_ORDER:
    "Mã vừa quét không có trong lệnh chuyển kho — để riêng, không cho vào kiện.",
  PACK_QUANTITY_EXCEEDS_ORDER:
    "Vượt quá số lượng còn cần của dòng này trong lệnh. Dữ liệu đã được tải lại.",
  // BE PR #164 final: mở phiên và mở lại / niêm phong kiện giữ hàng ở kho nguồn cho lệnh — có thể không đủ
  INSUFFICIENT_STOCK:
    "Kho nguồn không còn đủ hàng khả dụng để giữ cho lệnh này (hàng đã giữ cho đơn khác hoặc đã xuất). Báo quản lý kho kiểm tra tồn rồi thử lại.",
  RESERVATION_NOT_ACTIVE:
    "Phần hàng đã giữ cho lệnh không còn hiệu lực (đã nhả hoặc hết hạn). Tải lại phiên rồi thử lại.",
  INVENTORY_POLICY_STOCK_CONFLICT:
    "Tồn của SKU chưa khớp chính sách xuất (FIFO/FEFO) — liên hệ quản lý kho kiểm tra lại tồn.",
  PACK_SCAN_AMBIGUOUS: "Mã này có ở nhiều dòng của lệnh — chọn đúng dòng rồi quét lại.",
  PACKING_INCOMPLETE:
    "Chưa đóng đủ số lượng của lệnh. Đóng nốt, hoặc chọn chỉ chuyển phần đã đóng và ghi lý do.",
  KIT_INCOMPLETE: "Một bộ còn phần chưa niêm phong — niêm phong đủ các phần hoặc huỷ cả bộ.",
  KIT_PART_COUNT_MISMATCH:
    "Số phần của bộ không khớp số thùng mà hàng này đi theo danh mục. Để trống ô số phần để lấy theo danh mục.",
  KIT_CONTENTS_INVALID: "Chỉ phần 1 của bộ chứa hàng, và đúng một đơn vị của dòng hàng đó.",
  KIT_ITEM_MISMATCH: "Bộ này được mở cho hàng khác — quét đúng hàng của bộ.",
  KIT_OVERRIDE_REASON_REQUIRED:
    "Hàng này đi nhiều thùng (đóng bộ). Muốn đóng vào kiện thường thì phải ghi lý do.",
  STOCK_CARTON_NOT_SHIPPABLE:
    "Thùng này không giao nguyên được: cần thùng chưa mở, còn hàng bán được ở kho nguồn, thuộc SKU (và lô) của lệnh, không đang giữ cho việc khác và không vượt số lượng lệnh còn cần.",
  OUT_OF_DATA_SCOPE: "Lệnh này thuộc kho nguồn ngoài phạm vi bạn được thao tác.",
  PACKAGE_NOT_FOUND: "Không tìm thấy kiện (có thể đã bị huỷ ở nơi khác). Dữ liệu đã được tải lại.",
} as const;

/** Mã lỗi cho thấy phiên / lệnh đã đổi ở nơi khác → tải lại phiên (xem `transfer-pack-errors.ts`). */
export const TRANSFER_PACK_STALE_ERROR_CODES = [
  "PACKING_TAKEN",
  "PACK_STATE_CONFLICT",
  "PACK_QUANTITY_EXCEEDS_ORDER",
  "PACKAGE_SEALED",
  "PACKAGE_EMPTY",
  "PACKAGE_NOT_SEALED",
  "PACKAGE_SHIPPED",
  "PACKAGE_NOT_FOUND",
  "PACK_LOT_MISMATCH",
  "PACKING_INCOMPLETE",
  "KIT_INCOMPLETE",
  "INVALID_TRANSFER_TRANSITION",
  "NOT_FOUND",
  "RESERVATION_NOT_ACTIVE",
] as const;

/** Tên field BE của `VALIDATION_FAILED` → câu tiếng Việt (gồm các field riêng của chuyển kho). */
export const TRANSFER_PACK_VALIDATION_FIELD_MESSAGES = {
  lpn: TRANSFER_PACK_FIELD_MESSAGES.lpnRequired,
  partCount: TRANSFER_PACK_FIELD_MESSAGES.partCountRange,
  transferLineId: TRANSFER_PACK_FIELD_MESSAGES.lineRequired,
  note: TRANSFER_PACK_FIELD_MESSAGES.noteRequired,
  packageType: "Loại kiện không hợp lệ.",
  weightKg: "Khối lượng phải là số dương.",
  lengthCm: "Kích thước phải là số dương.",
  widthCm: "Kích thước phải là số dương.",
  heightCm: "Kích thước phải là số dương.",
  scannedCode: "Nhập hoặc quét mã hàng.",
  quantity: "Số lượng phải từ 1 đến 1.000.000.",
} as const;
