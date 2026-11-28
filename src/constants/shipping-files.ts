/**
 * File đính kèm của giao hàng (docs 09 §4.4, §4.3 bước 2, BR-28): file vận đơn của chuyến và biên bản giao nhận (POD) của
 * lô giao. Giới hạn khớp BE `FileCategory.DOCUMENT` (PDF / Word / Excel / ảnh JPEG, PNG; tối đa 25 MB) — FE chỉ chặn sớm,
 * BE kiểm lại theo byte và là bên quyết (415 / 413). POD: BE chỉ nhận PDF hoặc ảnh (`ShipmentPodFiles`).
 *
 * Tầng thấp nhất: không import gì từ `src/` ngoài `constants/`.
 */

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const JPEG = "image/jpeg";
const PNG = "image/png";

export const SHIPPING_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const SHIPPING_FILE_RULES = {
  /** File vận đơn: PDF, ảnh, Word hoặc Excel của hãng (docs 09 §3, §4.4). */
  waybill: {
    maxBytes: SHIPPING_FILE_MAX_BYTES,
    contentTypes: [PDF, DOCX, XLSX, JPEG, PNG],
    accept: ".pdf,.docx,.xlsx,.jpg,.jpeg,.png",
  },
  /** POD: PDF hoặc ảnh chụp biên bản có chữ ký (docs 09 §4.3 bước 2). */
  pod: {
    maxBytes: SHIPPING_FILE_MAX_BYTES,
    contentTypes: [PDF, JPEG, PNG],
    accept: ".pdf,.jpg,.jpeg,.png",
  },
} as const;

export type ShippingFileKind = keyof typeof SHIPPING_FILE_RULES;

/** Tên loại file hiển thị theo `contentType` BE trả; loại lạ (vd. CSV nhập mã vận đơn) hiện "Tệp". */
export const SHIPPING_FILE_TYPE_LABELS: Readonly<Record<string, string>> = {
  [PDF]: "PDF",
  [DOCX]: "Word",
  [XLSX]: "Excel",
  [JPEG]: "Ảnh JPEG",
  [PNG]: "Ảnh PNG",
  "text/csv": "CSV",
};

const COMMON = {
  columns: {
    name: "Tên file",
    type: "Loại",
    size: "Dung lượng",
    uploadedAt: "Tải lên lúc",
    uploadedBy: "Người tải lên",
    actions: "Thao tác",
  },
  typeOther: "Tệp",
  download: "Tải xuống",
  downloading: "Đang mở…",
  choose: "Chọn file để tải lên",
  chooseHint: "hoặc kéo thả file vào đây",
  retry: "Thử lại",
  loadFailed: "Không tải được danh sách file.",
  viewOnly: "Bạn chỉ có quyền xem và tải xuống file, không có quyền tải file lên.",
  stage: {
    hashing: "Đang kiểm tra file…",
    declaring: "Đang chuẩn bị tải lên…",
    uploading: (percent: number) => `Đang tải lên ${percent}%`,
    attaching: "Đang đính kèm…",
  },
  uploaded: (fileName: string) => `Đã đính kèm “${fileName}”.`,
  /** Lỗi chọn file (kiểm ở máy trước khi gửi). */
  fileProblem: {
    empty: "File rỗng — chọn file khác.",
    tooLarge: "File lớn hơn 25 MB — chọn file nhỏ hơn.",
  },
  /** Lỗi BE / kho — không bao giờ hiện message tiếng Anh của máy chủ. */
  error: {
    unsupportedType: "Nội dung file không đúng loại của nó. Chọn lại file gốc rồi thử lại.",
    tooLarge: "File lớn hơn 25 MB — chọn file nhỏ hơn.",
    rejected:
      "File không được chấp nhận (sai loại, bị hỏng hoặc có nội dung không an toàn). Chọn file khác.",
    rateLimited: "Bạn tải lên quá nhiều lần trong một giờ. Đợi một lúc rồi thử lại.",
    conflict: "File này đang được đính kèm ở một thao tác khác. Đợi một lát rồi thử lại.",
    forbidden: "Bạn không có quyền tải file lên ở đây.",
    storageRefused:
      "Kho lưu trữ từ chối file (đường tải đã hết hạn hoặc file bị thay đổi). Chọn lại file rồi thử lại.",
    network: "Mất kết nối khi tải file. Kiểm tra mạng rồi thử lại.",
    unavailable: "Hệ thống lưu trữ file đang gặp sự cố. Thử lại sau ít phút.",
    unknown: "Không tải được file lên. Thử lại sau.",
    openFailed: "Không mở được file để tải xuống. Thử lại.",
  },
} as const;

export const SHIPPING_FILE_LABELS = {
  common: COMMON,
  /** File vận đơn trên chuyến (BE `LoadWaybillController`). */
  waybill: {
    title: "File vận đơn",
    description:
      "PDF, ảnh hoặc Excel của hãng vận chuyển, đính kèm chuyến này. Không bắt buộc; khách hàng không xem được file này.",
    empty: "Chưa có file vận đơn nào.",
    upload: "Tải file vận đơn lên",
    typeHint: "PDF, Word, Excel hoặc ảnh JPEG / PNG, tối đa 25 MB.",
    typeNotAccepted: "File vận đơn chỉ nhận PDF, Word, Excel hoặc ảnh JPEG / PNG.",
    notBooked:
      "Chỉ tải file vận đơn lên sau khi đã đặt xe với hãng. Ghi nhận đặt xe trước, rồi quay lại đây.",
    cancelled: "Chuyến đã huỷ nên không đính kèm thêm file vận đơn được; file đã có vẫn xem được.",
    stateConflict: "Chuyến đã huỷ nên không đính kèm thêm file vận đơn được.",
    notFound: "Không tìm thấy chuyến này nữa. Tải lại trang rồi thử lại.",
    rejected: COMMON.error.rejected,
  },
  /** Biên bản giao nhận của lô giao (BE `ShipmentPodController`). */
  pod: {
    title: "Biên bản giao nhận (POD)",
    description:
      "Ảnh hoặc PDF biên bản giao nhận có chữ ký của khách, tải lên khi ghi tay kết quả giao. Không bắt buộc — thiếu biên bản vẫn ghi nhận được giao thành công; khách hàng không xem được file này.",
    empty: "Chưa có biên bản giao nhận nào.",
    upload: "Tải biên bản giao nhận lên",
    typeHint: "PDF hoặc ảnh JPEG / PNG, tối đa 25 MB.",
    typeNotAccepted: "Biên bản giao nhận chỉ nhận PDF hoặc ảnh JPEG / PNG.",
    notDelivered:
      "Chỉ tải biên bản giao nhận lên được sau khi lô đã giao thành công. Ghi nhận kết quả giao trước, rồi quay lại đây.",
    notApplicable:
      "Lô này đã hoàn về kho hoặc đã huỷ, không có giao thành công nên không có biên bản giao nhận để tải lên.",
    stateConflict:
      "Lô chưa ở trạng thái đã giao nên chưa tải biên bản lên được. Tải lại trang rồi thử lại.",
    notFound: "Không tìm thấy lô giao này nữa. Tải lại trang rồi thử lại.",
    rejected: "Biên bản giao nhận chỉ nhận PDF hoặc ảnh JPEG / PNG và file phải đọc được.",
  },
} as const;
