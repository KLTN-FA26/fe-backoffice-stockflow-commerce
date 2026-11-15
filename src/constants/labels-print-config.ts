/**
 * Nhãn và câu báo của cấu hình in (module 12, back-office): luật của form lưu, lỗi BE → tiếng Việt, toast, tên số đo.
 * Không import gì từ phần còn lại của `src/`.
 */

export const PRINT_CONFIG_FIGURE_LABELS = {
  topDiameterMm: "Đường kính miệng",
  bottomDiameterMm: "Đường kính đáy",
  heightMm: "Chiều cao",
  bandTopOffsetMm: "Dải in cách miệng",
  bandBottomOffsetMm: "Dải in cách đáy",
  widthMm: "Chiều rộng",
  gussetMm: "Độ rộng hông",
} as const;

export const PRINT_CONFIG_SCHEMA_MESSAGES = {
  meshName: (code: string) => `Mesh của vùng in ${code} phải tên là print:${code}.`,
  surfaceMissing: (code: string) => `Vùng in ${code} chưa có mesh trong bảng ghép.`,
  surfaceTwice: (code: string) => `Vùng in ${code} xuất hiện hai lần trong bảng ghép.`,
  surfaceUnknown: (code: string) => `Bảng ghép nêu vùng in ${code} mà mẫu không có.`,
  areaTwice: (code: string) => `Vùng in ${code} khai báo hai lần.`,
  cupAreas: "Ly chỉ có một vùng in là BODY.",
  bagAreas: "Túi có bốn vùng in: FRONT, BACK, LEFT, RIGHT.",
  fileExtension: "File model phải là .glb.",
  fileEmpty: "File model đang rỗng.",
  fileTooLarge: (maxMb: number) => `File model tối đa ${maxMb} MB.`,
  pairRequired:
    "Số đo đã đổi nhưng không kèm file .glb mới hoặc mã kiểm của file đang lưu. Hãy tải lại file để đo lại.",
} as const;

export const PRINT_CONFIG_ERROR_MESSAGES = {
  fallback: "Không thực hiện được thao tác. Vui lòng thử lại.",
  PRODUCT_NOT_CUSTOMIZABLE:
    "Sản phẩm này không phải sản phẩm in theo thiết kế nên không có cấu hình in.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
  VARIANT_NOT_FOUND: "Không tìm thấy biến thể.",
  PRINT_CONFIG_NOT_FOUND: "Không tìm thấy cấu hình in — có thể đã bị đổi. Dữ liệu đã được tải lại.",
  PRINT_CONFIG_INVALID: "Cấu hình in chưa hợp lệ (kích thước, vùng in hoặc lề không đúng).",
  PRINT_CONFIG_CODE_TAKEN: "Mã cấu hình in đã có ở biến thể này.",
  OPTIMISTIC_LOCK:
    "Cấu hình in vừa được người khác sửa. Dữ liệu đã được tải lại, hãy kiểm tra rồi lưu lại.",
  CONFLICT: "Biến thể hoặc sản phẩm đã ngừng bán nên cấu hình in được giữ nguyên.",
  MODEL_FILE_PAIR_REQUIRED: PRINT_CONFIG_SCHEMA_MESSAGES.pairRequired,
  MODEL_FILE_CHECKSUM_MISMATCH:
    "File vừa tải lên không phải file đã dùng để đo. Hãy chọn lại file.",
  MODEL_FILE_REJECTED: "File model không qua kiểm tra của hệ thống.",
  SECURE_CONTEXT_REQUIRED:
    "Trình duyệt không tính được mã kiểm của file vì trang đang mở qua http không bảo mật. Hãy mở trang này bằng địa chỉ https hoặc bằng localhost rồi lưu lại.",
  FORBIDDEN: "Bạn không có quyền sửa cấu hình in.",
  PAYLOAD_TOO_LARGE: "File model quá lớn (tối đa 10 MB).",
  UNSUPPORTED_MEDIA_TYPE: "File model phải là .glb (glTF 2.0 nhị phân).",
} as const;

export const PRINT_CONFIG_TOAST_MESSAGES = {
  saved: "Đã lưu cấu hình in",
  activated: "Đã kích hoạt cấu hình in",
  deactivated: "Đã ngừng dùng cấu hình in",
} as const;

export const PRINT_CONFIG_ACTION_LABELS = {
  save: "Lưu cấu hình in",
  activate: "Kích hoạt",
  deactivate: "Ngừng dùng",
} as const;

export const PRINT_CONFIG_STATUS_LABELS = {
  INACTIVE: "Chưa kích hoạt",
  ACTIVE: "Đang dùng",
} as const;

/** Chữ của màn hình "Cấu hình in" của biến thể (module 12, back-office). Câu về file 3D lấy từ `labels-model3d.ts`. */
export const PRINT_CONFIG_SCREEN_LABELS = {
  title: "Cấu hình in",
  loadFailed: "Không tải được cấu hình in.",
  retry: "Thử lại",
  empty: {
    title: "Chưa có cấu hình in",
    description:
      "Tải lên file model 3D (.glb) dựng từ Blender. Hệ thống đọc file ngay trên máy bạn, tự đo kích thước và sinh khuôn in 2D từ đó; số đo không gõ bằng tay.",
    readOnly: "Biến thể này chưa có cấu hình in.",
    checklistTitle: "File .glb cần dựng như sau",
  },
  kinds: { cup: "Ly", bag: "Túi" },
  summary: {
    kind: "Loại sản phẩm",
    measuredTitle: "Số đo lấy từ file 3D",
    defaultsTitle: "Số mặc định (cần xác nhận với nhà sản xuất hoặc nhà in)",
    areasTitle: "Vùng in",
    areaColumns: {
      area: "Vùng in",
      size: "Kích thước",
      safeMargin: "Lề an toàn",
      bleed: "Tràn lề",
    },
    file: "File 3D",
    fileAttached: "Đã đính kèm file 3D",
    fileMissing: "Chưa có file 3D",
    noModel: "Cấu hình cũ, chưa có số đo từ model 3D.",
  },
  dropzone: {
    choose: "Chọn hoặc kéo thả file .glb",
    chooseAnother: "Chọn hoặc kéo thả file .glb khác",
    hint: "File được đọc ngay trên máy bạn; chỉ khi bấm Lưu mới được gửi đi.",
    reading: (name: string) => `Đang đọc ${name}…`,
  },
  report: {
    recognized: (kind: string) => `Nhận ra: ${kind}`,
    unknownKind: "Chưa nhận ra loại sản phẩm",
    fileName: (name: string) => `File: ${name}`,
    measuredTitle: "Số đo đọc được từ file",
    defaultsTitle: "Số hệ thống tự điền (mặc định)",
    defaultsNote:
      "Các số dưới đây không đọc được từ file: hệ thống tự điền số mặc định, hãy xác nhận lại với nhà sản xuất hoặc nhà in.",
    partsTitle: "Từng phần in trong file",
    partColumns: { part: "Phần in", name: "Tên trong file", size: "Số đo" },
    unreadSize: "Chưa đọc được số đo",
    bandSize: (top: string, bottom: string, height: string) =>
      `Miệng ${top}, đáy ${bottom}, cao ${height}`,
    faceSize: (width: string, height: string) => `${width} × ${height}`,
    meshInFile: "Phần trong file",
  },
  issues: {
    allClear: "File đạt các bước kiểm: không có lỗi hay cảnh báo.",
    errorsHeading: (count: number) => `Có ${count} lỗi cần sửa trong Blender`,
    warningsHeading: "Không có lỗi chặn, nhưng có cảnh báo",
    listLabel: "Lỗi và cảnh báo",
    blockedByErrors: "Có lỗi nên chưa lưu được. Sửa file trong Blender rồi chọn lại file.",
    bagIncomplete:
      "Chưa đủ mặt để dựng cấu hình của cả túi từ file này nên chưa lưu được. Kích thước từng mặt vẫn hiển thị ở trên.",
  },
  nominal: {
    legend: "Số trong bảng thông số của nhà sản xuất (không bắt buộc)",
    hint: "Gõ vào để so với số đo đọc được. Ô để trống thì bỏ qua. Lệch quá 1 mm sẽ có cảnh báo, không chặn việc lưu.",
    invalid: "Nhập một số lớn hơn 0.",
    unit: (label: string) => `${label} (mm)`,
  },
  advanced: {
    toggle: "Nâng cao: số mặc định",
    note: "Hệ thống tự điền các số này vì file không nói được; hãy xác nhận với nhà sản xuất hoặc nhà in.",
    fields: {
      safeMarginMm: "Lề an toàn (mm)",
      bleedMm: "Tràn lề (mm)",
      seamMm: "Mép dán (mm)",
      rimMm: "Vành miệng ly (mm)",
      cupMaterial: "Chất liệu ly",
      bagMaterial: "Chất liệu túi",
      handle: "Quai túi",
      topFoldMm: "Gập miệng túi (mm)",
    },
    cupMaterials: {
      "paper-white": "Giấy trắng",
      kraft: "Giấy kraft",
      "pet-clear": "Nhựa PET trong",
    },
    bagMaterials: { "kraft-brown": "Kraft nâu", "kraft-white": "Kraft trắng" },
    handles: { twisted: "Quai xoắn", flat: "Quai dẹt", none: "Không quai" },
    validation: {
      number: "Nhập một số.",
      notNegative: "Không được âm.",
      bleedMax: (max: number) => `Tối đa ${max} mm.`,
    },
  },
  defaultRows: {
    safeMarginMm: "Lề an toàn",
    bleedMm: "Tràn lề",
    seamMm: "Mép dán",
    rimMm: "Vành miệng ly",
    cupMaterial: "Chất liệu ly",
    bagMaterial: "Chất liệu túi",
    handle: "Quai túi",
    topFoldMm: "Gập miệng túi",
  },
  readOnly: {
    permission: "Bạn không có quyền sửa cấu hình in, nên chỉ xem được.",
    product: "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh nên chưa sửa được cấu hình in.",
    variant: "Biến thể này đã ngừng dùng nên không sửa được cấu hình in.",
  },
  status: {
    activateNote: "Kích hoạt: khách hàng của biến thể này bắt đầu thiết kế trên cấu hình in này.",
    activateTitle: "Kích hoạt cấu hình in?",
    activateDescription:
      "Khách hàng của biến thể này sẽ bắt đầu thiết kế trên cấu hình in này. Cấu hình đang dùng trước đó (nếu có) sẽ ngừng dùng.",
    deactivateTitle: "Ngừng dùng cấu hình in?",
    deactivateDescription:
      "Khách hàng sẽ không bắt đầu thiết kế mới trên cấu hình in này. Bản thiết kế đang làm dở vẫn giữ cấu hình này.",
  },
  unreadableTitle: "Không đọc được file",
  discard: "Bỏ file đã chọn",
  serverField: "Máy chủ không chấp nhận giá trị này.",
  save: {
    saving: "Đang lưu…",
    nothingToSave: "Chưa có thay đổi để lưu.",
    newFile: (name: string) => `Sẽ lưu cùng file ${name}.`,
    defaultsOnly: "Chỉ đổi số mặc định: file 3D đang lưu được giữ nguyên.",
    failedTitle: "Không lưu được cấu hình in",
  },
  newConfig: {
    cup: { code: "CUP-BODY", name: "Thân ly" },
    bag: { code: "BAG-FACES", name: "Bốn mặt túi" },
  },
} as const;

/** Chữ của trang "Cấu hình in" của một biến thể (`/admin/products/[id]/variants/[variantId]/print-config`). */
export const PRINT_CONFIG_PAGE_LABELS = {
  /** Tiêu đề cho screen reader (trang không hiện title) và chữ breadcrumb của trang. */
  pageTitle: "Cấu hình in",
  backToProduct: "Về sản phẩm",
  variantHeading: "Biến thể",
  notCustomizable: {
    title: "Sản phẩm này không có cấu hình in",
    description:
      "Cấu hình in chỉ áp dụng cho sản phẩm tuỳ chỉnh / in ấn. Sản phẩm tiêu chuẩn được bán nguyên mẫu nên không cần file model 3D.",
  },
  variantNotFound: {
    title: "Không tìm thấy biến thể",
    description: "Biến thể không thuộc sản phẩm này hoặc đã bị xoá.",
  },
  loadFailed: {
    title: "Không tải được trang cấu hình in",
    description: "Kiểm tra kết nối rồi thử tải lại.",
  },
} as const;
