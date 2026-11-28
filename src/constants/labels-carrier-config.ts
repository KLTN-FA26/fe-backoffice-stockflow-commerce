/**
 * Cấu hình kết nối hãng tích hợp API đặt xe trong hộp thoại hãng (docs 09 §4.1 bước 2; BE `CarrierConnectionRequest`,
 * `CarrierServiceCodesRequest`, `CarrierPickupPointsRequest`): giới hạn độ dài theo BE, nhãn, thông báo ô và lỗi.
 */

import { SHIPPING_LIMITS } from "./numbers";

/** Giới hạn của BE (`CarrierService`, `CarrierConnection`, `CarrierServiceCodeService`, `CarrierPickupPoints`, `FailureReasonMap`). */
export const CARRIER_CONFIG_LIMITS = {
  /** `CarrierConnection.ACCOUNT`: 3-64 ký tự in được, không khoảng trắng. */
  apiAccountMin: 3,
  apiAccountMax: 64,
  /** `CarrierConnectionRequest.apiKey`: 8-512 ký tự. */
  apiKeyMin: 8,
  apiKeyMax: 512,
  /** `CarrierConnection.HEADER_NAME`: chữ, số, `-`, tối đa 64. */
  webhookAuthHeaderMax: 64,
  /** `CarrierConnectionRequest.webhookAuthValue`: 16-512 ký tự. */
  webhookAuthValueMin: 16,
  webhookAuthValueMax: 512,
  /** `FailureReasonMap.MAX_ENTRIES` / `MAX_WORDING`. */
  failureReasonMaxRows: 100,
  failureReasonWordingMax: 200,
  /** `CarrierServiceCodeService`: tối đa 500 mã; tỉnh ≤ 20, mã thành phố của hãng ≤ 32, mã dịch vụ ≤ 64. */
  serviceCodeMaxRows: 500,
  provinceCodeMax: 20,
  carrierCityCodeMax: 32,
  serviceCodeMax: 64,
  /** `CarrierPickupPointsRequest`: tối đa 200 điểm; địa chỉ ≤ 500, người liên hệ ≤ 120, điện thoại ≤ 32. */
  pickupPointMaxRows: 200,
  pickupAddressMax: 500,
  pickupContactNameMax: 120,
  pickupContactPhoneMax: 32,
} as const;

export const CARRIER_API_ENVIRONMENTS = ["STAGING", "PRODUCTION"] as const;
export type CarrierApiEnvironment = (typeof CARRIER_API_ENVIRONMENTS)[number];

const L = CARRIER_CONFIG_LIMITS;

export const CARRIER_CONFIG_LABELS = {
  /** Kiểu kết nối dạng thẻ chọn (artboard "Thêm hãng vận chuyển"). */
  connectionTypeGroup: "Kiểu kết nối",
  api: {
    title: "Kết nối API đặt xe",
    description:
      "Hệ thống gọi API của hãng để tạo và huỷ đơn đặt xe. Khoá API và thông tin xác thực webhook chỉ đi vào, không hiển thị lại sau khi lưu.",
    environment: "Môi trường",
    environmentPlaceholder: "Chọn môi trường",
    environmentOption: {
      STAGING: "Thử nghiệm",
      PRODUCTION: "Chạy thật",
    },
    account: "Tài khoản ở hãng",
    accountHint:
      "Với Ahamove: số điện thoại đã đăng ký tài khoản. 3–64 ký tự, không có khoảng trắng.",
    apiKey: "Khoá API",
    apiKeyHint: `${L.apiKeyMin}–${L.apiKeyMax} ký tự, không có khoảng trắng đầu / cuối. Khoá cấp theo từng tài khoản và môi trường.`,
    apiKeyChangeNeedsNew:
      "Đổi môi trường hoặc tài khoản thì phải nhập lại khoá API của tài khoản đó.",
    webhookAuthHeader: "Tên header xác thực webhook",
    webhookAuthHeaderHint:
      "Webhook là cách hãng tự báo sự kiện (nhận đơn, lấy hàng, giao) về hệ thống; header là dòng xác thực hãng gửi kèm mỗi lần báo, ví dụ apikey hoặc Authorization.",
    webhookAuthValue: "Giá trị xác thực webhook",
    webhookAuthValueHint: `Toàn bộ giá trị mong đợi trong header đó (${L.webhookAuthValueMin}–${L.webhookAuthValueMax} ký tự, không có khoảng trắng đầu / cuối).`,
    rotationUnderWay:
      "Đang thay thông tin xác thực webhook: hệ thống chấp nhận cả giá trị cũ lẫn giá trị mới. Nhập giá trị mới ở đây sẽ kết thúc việc thay đó.",
  },
  secret: {
    saved: "Đã lưu",
    replace: "Thay khoá",
    replaceAria: (label: string) => `Thay ${label.toLowerCase()}`,
    keep: "Giữ khoá hiện tại",
    keepAria: (label: string) => `Giữ ${label.toLowerCase()} hiện tại`,
    replaceHint: "Nhập khoá mới. Để trống thì giữ khoá đã lưu.",
    notSaved: "Chưa lưu",
    // Xem lại khoá đang gõ để chắc không gõ nhầm (UX audit S20-1); khoá đã lưu thì vẫn không bao giờ hiện lại
    show: "Hiện",
    hide: "Ẩn",
    showAria: (label: string) => `Hiện ${label.toLowerCase()} đang gõ`,
    hideAria: (label: string) => `Ẩn ${label.toLowerCase()} đang gõ`,
  },
  table: {
    add: "Thêm dòng",
    remove: "Xoá dòng",
    removeAria: (n: number) => `Xoá dòng ${n}`,
    loading: "Đang tải…",
    loadFailed: "Không tải được danh sách đã lưu.",
    retry: "Thử lại",
    emptyRows: "Chưa có dòng nào.",
  },
  failureReasons: {
    title: "Bảng ánh xạ lý do giao thất bại",
    description:
      "Lý do hãng nêu khi giao thất bại sẽ được ghi thành mã lý do của hệ thống. Lý do không có trong bảng được ghi là “Lý do khác” kèm nguyên văn lý do của hãng.",
    wording: "Lý do theo cách hãng nêu",
    wordingPlaceholder: "Ví dụ: Khách hàng không nghe máy",
    reason: "Mã lý do của hệ thống",
    reasonPlaceholder: "Chọn lý do",
    add: "Thêm lý do",
    empty: "Chưa có lý do nào: mọi lý do hãng nêu sẽ được ghi là “Lý do khác”.",
  },
  serviceCodes: {
    title: "Mã dịch vụ theo loại xe và thành phố",
    description:
      "Mỗi loại xe ứng với một mã dịch vụ của hãng ở từng thành phố. Danh sách được thay thế toàn bộ mỗi lần lưu.",
    vehicleType: "Loại xe",
    vehicleTypePlaceholder: "Chọn loại xe",
    province: "Tỉnh / thành phố",
    provincePlaceholder: "Chọn tỉnh / thành",
    carrierCity: "Mã thành phố của hãng",
    carrierCityPlaceholder: "Ví dụ: SGN",
    serviceCode: "Mã dịch vụ của hãng",
    serviceCodePlaceholder: "Mã dịch vụ",
    add: "Thêm mã dịch vụ",
    empty: "Chưa có mã dịch vụ: chưa đặt xe qua hãng này được.",
    vehicleTypesFailed: "Không tải được danh mục loại xe.",
    lookup: "Tra dịch vụ của hãng",
    lookupAria: (n: number) => `Tra dịch vụ của hãng cho dòng ${n}`,
    lookupNeedsSaved: "Lưu hãng với kiểu “Tích hợp API đặt xe” trước khi tra dịch vụ của hãng.",
    lookupNeedsCity: "Nhập mã thành phố của hãng trước.",
    lookupLoading: "Đang hỏi hãng…",
    lookupRefused:
      "Hãng không trả được danh sách dịch vụ — kiểm tra khoá API, tài khoản và mã thành phố của hãng.",
    lookupUnreachable: "Hãng không phản hồi lúc này — thử lại sau.",
    lookupEmpty: "Hãng không trả dịch vụ nào cho thành phố này.",
    lookupPick: "Chọn",
    lookupClose: "Đóng",
    lookupTitle: "Dịch vụ xe tải của hãng",
  },
  pickupPoints: {
    title: "Điểm lấy hàng theo kho",
    description:
      "Mỗi kho xuất một điểm lấy hàng, ghi địa chỉ đúng như hãng đọc được. Danh sách được thay thế toàn bộ mỗi lần lưu.",
    warehouse: "Kho",
    warehousePlaceholder: "Chọn kho",
    province: "Tỉnh / thành phố",
    provincePlaceholder: "Chọn tỉnh / thành",
    address: "Địa chỉ như hãng đọc",
    addressPlaceholder: "Số nhà, đường, phường, quận, thành phố",
    contactName: "Người giao hàng cho hãng",
    contactPhone: "Điện thoại",
    add: "Thêm điểm lấy hàng",
    empty: "Chưa có điểm lấy hàng: chưa đặt xe qua hãng này được.",
  },
  saveProgress: {
    carrierPart: "thông tin hãng",
    serviceCodesPart: "mã dịch vụ",
    pickupPointsPart: "điểm lấy hàng",
    outOfScope: "có kho bạn không phụ trách — bỏ dòng của kho đó",
    warehouseNotFound: "có kho không còn trong danh mục — chọn lại kho",
    /** Hãng lưu xong nhưng một danh sách lỗi: nói rõ phần nào đã lưu, phần nào chưa (kèm lý do). */
    partial: (done: readonly string[], failed: readonly string[]) =>
      `Đã lưu ${done.join(", ")}. Chưa lưu được ${failed.join("; ")}. Sửa rồi bấm Lưu lại — phần đã lưu không bị mất.`,
  },
} as const;

/** Thông báo từng ô (client). */
export const CARRIER_CONFIG_MESSAGES = {
  apiEnvironmentRequired: "Chọn môi trường",
  apiAccountInvalid: `Tài khoản ${L.apiAccountMin}–${L.apiAccountMax} ký tự, không có khoảng trắng`,
  apiKeyRequired: "Nhập khoá API",
  apiKeyInvalid: `Khoá API ${L.apiKeyMin}–${L.apiKeyMax} ký tự, không có khoảng trắng đầu / cuối`,
  apiKeyNeedsNew: "Đổi môi trường hoặc tài khoản thì phải nhập lại khoá API",
  webhookAuthHeaderInvalid: `Tên header chỉ gồm chữ, số và “-”, tối đa ${L.webhookAuthHeaderMax} ký tự`,
  webhookAuthValueRequired: "Nhập giá trị xác thực webhook",
  webhookAuthValueInvalid: `Giá trị xác thực ${L.webhookAuthValueMin}–${L.webhookAuthValueMax} ký tự, không có khoảng trắng đầu / cuối`,
  rowRequired: "Bắt buộc",
  noSpaces: "Không có khoảng trắng",
  tooLong: "Quá dài",
  tooManyRows: (max: number) => `Tối đa ${max} dòng`,
  wordingDuplicate: "Lý do này đã có trong bảng (không phân biệt hoa / thường)",
  serviceCodeDuplicate: "Loại xe này đã có mã dịch vụ ở tỉnh / thành này",
  pickupWarehouseDuplicate: "Mỗi kho chỉ có một điểm lấy hàng",
} as const;

/**
 * Lỗi từng ô do BE trả (`fieldErrors`) → câu tiếng Việt theo tên ô; câu gốc của BE là tiếng Anh nên không hiện.
 * Khoá là tên ô của `CarrierRequest` / `CarrierConnectionRequest`.
 */
export const CARRIER_FIELD_ERROR_MESSAGES = {
  code: "Mã hãng không hợp lệ",
  name: "Tên hãng không hợp lệ",
  contactName: "Người liên hệ không hợp lệ",
  contactPhone: "Điện thoại liên hệ không hợp lệ",
  status: "Trạng thái không hợp lệ",
  connectionType: "Kiểu kết nối không hợp lệ",
  webhookSecret: `Khoá bí mật ${SHIPPING_LIMITS.webhookSecretMin}–${SHIPPING_LIMITS.webhookSecretMax} ký tự, không có khoảng trắng đầu / cuối`,
  apiEnvironment: CARRIER_CONFIG_MESSAGES.apiEnvironmentRequired,
  apiAccount: CARRIER_CONFIG_MESSAGES.apiAccountInvalid,
  apiKey: "Khoá API chưa hợp lệ hoặc thiếu — đổi môi trường / tài khoản thì phải nhập lại khoá",
  webhookAuthHeader: CARRIER_CONFIG_MESSAGES.webhookAuthHeaderInvalid,
  webhookAuthValue: CARRIER_CONFIG_MESSAGES.webhookAuthValueInvalid,
  failureReasonMap: "Bảng lý do giao thất bại không hợp lệ (trùng lý do hoặc quá dài)",
} as const;

/** Lỗi theo mã của BE riêng cho cấu hình hãng (thêm vào `SHIPPING_ERROR_MESSAGES`). */
export const CARRIER_CONFIG_ERROR_MESSAGES = {
  CARRIER_NOT_API_BOOKING:
    "Hãng này chưa ở kiểu “Tích hợp API đặt xe” nên chưa lưu được danh sách này — lưu kiểu kết nối trước rồi thử lại.",
  VEHICLE_TYPE_NOT_FOUND:
    "Có loại xe không còn trong danh mục — chọn lại loại xe ở các dòng mã dịch vụ.",
} as const;

/** Mã lỗi BE mà hộp thoại hãng xử lý riêng khi ghi danh sách điểm lấy hàng (kho ngoài phạm vi / không còn). */
export const CARRIER_LIST_ERROR_CODES = {
  outOfScope: "OUT_OF_DATA_SCOPE",
  notFound: "NOT_FOUND",
} as const;
