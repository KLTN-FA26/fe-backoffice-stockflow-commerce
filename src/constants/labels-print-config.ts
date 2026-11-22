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
  areaTwice: (code: string) => `Vùng in ${code} khai báo hai lần.`,
  cupAreas: "Ly chỉ có một vùng in là BODY.",
  bagAreas: "Túi có bốn vùng in: FRONT, BACK, LEFT, RIGHT.",
  fileExtension: "File model phải là .glb.",
  fileEmpty: "File model đang rỗng.",
  fileTooLarge: (maxMb: number) => `File model tối đa ${maxMb} MB.`,
  /** Lưu không kèm file mới mà đổi số đo, loại sản phẩm hoặc bảng ghép (BE 409 PRINT_CONFIG_MODEL_FILE_REQUIRED). */
  modelFileRequired: "Số đo này lấy từ file 3D, hãy tải file mới cùng số đo.",
  /** Tạo cấu hình in mới mà không có file (BE 409 PRINT_CONFIG_MODEL_FILE_REQUIRED). */
  fileRequiredToCreate: "Cấu hình in mới phải tạo cùng file 3D (.glb): hãy chọn file rồi lưu.",
  /** Số đo từ file ngoài khoảng BE nhận (BE `PrintConfigRules` `Range`). */
  measuredPositive: (label: string, max: number) =>
    `${label} đo từ file phải lớn hơn 0 và không quá ${max} mm: hãy kiểm tra đơn vị của file.`,
  measuredNonNegative: (label: string, max: number) =>
    `${label} đo từ file phải từ 0 đến ${max} mm: hãy kiểm tra lại file.`,
  cupTooSmall: (label: string, min: number) =>
    `${label} của ly đo từ file nhỏ hơn ${min} mm: hãy kiểm tra đơn vị của file.`,
  baseWiderThanRim: "Đáy ly đo từ file rộng hơn miệng ly: hãy kiểm tra lại file.",
  noBand: "Phần không in ở miệng và đáy ly (đo từ file) chiếm hết thân ly, không còn dải để in.",
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
  PRINT_CONFIG_MODEL_FILE_REQUIRED:
    "Số đo này lấy từ file 3D, hãy tải file mới cùng số đo. Dữ liệu đang lưu đã được tải lại.",
  OPTIMISTIC_LOCK:
    "Cấu hình in vừa được người khác sửa. Dữ liệu đã được tải lại, hãy kiểm tra rồi lưu lại.",
  CONFLICT: "Biến thể hoặc sản phẩm đã ngừng bán nên cấu hình in được giữ nguyên.",
  PRINT_CONFIG_SURFACES_INVALID:
    "Bảng ghép vùng in với mesh trong file không khớp với các vùng in của mẫu.",
  VALIDATION_FAILED:
    "Dữ liệu không hợp lệ: file model không qua bước quét virus của hệ thống, hoặc có giá trị bị từ chối. Không có gì được lưu.",
  RATE_LIMITED: "Hệ thống đang bận kiểm tra file. Hãy thử lưu lại sau ít phút.",
  FILE_STORED_DIFFERENT:
    "Máy chủ đã lưu một file khác với file đã dùng để đo, nên số đo có thể không khớp với file. Dữ liệu đang lưu đã được tải lại; hãy chọn lại file rồi lưu lại.",
  SECURE_CONTEXT_REQUIRED:
    "Trình duyệt không tính được mã kiểm của file vì trang đang mở qua http không bảo mật. Hãy mở trang này bằng địa chỉ https hoặc bằng localhost rồi lưu lại.",
  FORBIDDEN: "Bạn không có quyền sửa cấu hình in.",
  PAYLOAD_TOO_LARGE: "File model quá lớn (tối đa 10 MB).",
  UNSUPPORTED_MEDIA_TYPE: "File model phải là .glb (glTF 2.0 nhị phân).",
} as const;

/** Câu riêng theo việc đang làm, khi cùng một mã lỗi cần nói khác (tạo mới, kích hoạt). */
export const PRINT_CONFIG_CONTEXT_ERROR_MESSAGES = {
  create: {
    PRINT_CONFIG_MODEL_FILE_REQUIRED:
      "Cấu hình in mới phải tạo cùng file 3D (.glb): hãy chọn file rồi lưu.",
  },
  /** Gắn file khuôn tham chiếu (BD-7, BE `FileCategory.PRINT_TEMPLATE`: PDF hoặc PNG, tối đa 20 MB). */
  reference: {
    PAYLOAD_TOO_LARGE: "File khuôn quá lớn (tối đa 20 MB).",
    UNSUPPORTED_MEDIA_TYPE: "File khuôn phải là PDF hoặc PNG.",
    VALIDATION_FAILED:
      "File khuôn bị từ chối: không qua bước quét virus, hoặc là PDF có JavaScript, hành động tự chạy, file đính kèm hay bị mã hoá.",
    RATE_LIMITED: "Hệ thống đang bận kiểm tra file. Hãy thử gắn lại sau ít phút.",
    NOT_FOUND: "Cấu hình in này chưa có file khuôn tham chiếu.",
  },
  activate: {
    /** Chưa có file 3D, hoặc cấu hình cũ chưa có số đo của model: BE trả cùng 409 (8c63a729). */
    PRINT_CONFIG_MODEL_FILE_REQUIRED:
      "Chưa kích hoạt được: cấu hình in này chưa có file 3D hoặc chưa có số đo của model. Hãy tải file .glb lên cùng số đo rồi lưu, sau đó kích hoạt.",
    PRINT_CONFIG_SURFACES_INVALID:
      "Chưa kích hoạt được: file 3D đang lưu chưa có mesh print:<mã vùng in> cho mọi vùng in. Hãy tải lại file .glb đúng rồi lưu, sau đó kích hoạt.",
  },
} as const;

/** Từng lỗi của bảng ghép vùng in ↔ mesh, theo `code` của BE (`fieldErrors[].code` của 422 PRINT_CONFIG_SURFACES_INVALID). */
export const PRINT_CONFIG_SURFACE_ERROR_MESSAGES = {
  PrintAreaMissing: (code: string) => `Vùng in ${code} chưa có mesh print:${code} trong file.`,
  MeshNameMismatch: (code: string) => `Mesh của vùng in ${code} phải tên là print:${code}.`,
  PrintAreaUnknown: (code: string) => `Bảng ghép nêu vùng in ${code} mà mẫu không có.`,
  PrintAreaDuplicate: (code: string) => `Vùng in ${code} xuất hiện hai lần trong bảng ghép.`,
  Size: (code: string) => `Tên mesh của vùng in ${code} phải dài từ 1 đến 100 ký tự.`,
  missingUnnamed: "Có vùng in chưa có mesh trong bảng ghép.",
  unknownRow: (index: number) => `Dòng ${index + 1} của bảng ghép bị từ chối.`,
} as const;

export const PRINT_CONFIG_TOAST_MESSAGES = {
  saved: "Đã lưu cấu hình in",
  activated: "Đã kích hoạt cấu hình in",
  deactivated: "Đã ngừng dùng cấu hình in",
  referenceAttached: "Đã gắn file khuôn tham chiếu",
} as const;

/** Khối "File khuôn tham chiếu" của cấu hình in (BD-7): file PDF / PNG để khách so khuôn, không thuộc phiên bản in. */
export const PRINT_CONFIG_REFERENCE_LABELS = {
  title: "File khuôn tham chiếu",
  hint: "PDF hoặc PNG, tối đa 20 MB. Khách dùng để so khuôn; gắn hoặc thay file không ảnh hưởng thiết kế đang chờ duyệt.",
  none: "Chưa gắn file khuôn.",
  download: "Tải về",
  attach: "Gắn file khuôn",
  replace: "Thay file khuôn",
  inputLabel: "Chọn file khuôn tham chiếu (PDF hoặc PNG)",
  uploading: "Đang gắn file…",
  wrongType: "File khuôn phải là PDF hoặc PNG.",
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
  /**
   * Tiêu đề các khối của trang: dải đầu trang (biến thể, trạng thái, nút), cột làm việc (file, số mặc định, cấu hình
   * đang lưu) và cột xem (model 3D và khuôn in).
   */
  cards: {
    general: "Thông tin chung",
    configStatus: "Cấu hình in",
    saved: "Cấu hình đang lưu",
    file: "File 3D (.glb)",
    statusCard: "Trạng thái cấu hình in",
    header: "Biến thể và trạng thái cấu hình in",
    view: "Model 3D và khuôn in",
    viewEmpty:
      "Chọn file .glb ở cột bên trái: model 3D và khuôn in của file hiện ở đây để bạn kiểm trước khi lưu.",
  },
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
    fileLink: (name: string) => `Xem / tải ${name}`,
    fileLinkLoading: "Đang lấy liên kết tải file…",
    fileLinkFailed: "Chưa lấy được liên kết tải file.",
    fileChecksum: (short: string) => `SHA-256 ${short}…`,
    fileMissing: "Chưa có file 3D",
    noModel: "Cấu hình cũ, chưa có số đo từ model 3D.",
  },
  dropzone: {
    choose: "Chọn hoặc kéo thả file .glb",
    chooseAnother: "Chọn file .glb khác để thay",
    hint: "File được đọc ngay trên máy bạn; chỉ khi bấm Lưu mới được gửi đi.",
  },
  /** Dòng file đã chọn (thay ô chọn file cho tới khi lưu xong hoặc bỏ file). */
  chosenFile: {
    label: "File đã chọn",
    states: {
      reading: "Đang đọc…",
      read: "Đã đọc, chưa lưu",
      unreadable: "Không đọc được",
    },
    change: "Đổi file",
    changeInput: "Đổi file .glb",
    discard: "Bỏ file",
    notUploaded: 'File chưa được gửi lên. Bấm "Lưu cấu hình in" để lưu file cùng cấu hình.',
    notUploadedUnreadable: "File chưa được gửi lên và không lưu được. Hãy chọn file khác.",
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
    title: "Số mặc định (cần xác nhận với nhà in)",
    note: "File 3D không cho biết mép dán, vành miệng, chất liệu và lề in. Hệ thống điền sẵn số thường dùng; hãy kiểm lại với nhà sản xuất hoặc nhà in trước khi lưu.",
    fields: {
      safeMarginMm: "Lề an toàn (mm)",
      bleedMm: "Tràn lề (mm)",
      seamMm: "Mép dán (mm)",
      rimMm: "Vành miệng ly (mm)",
      cupMaterial: "Chất liệu ly",
      bagMaterial: "Chất liệu túi",
      handle: "Quai túi",
      topFoldMm: "Gập miệng túi (mm)",
      glueFlapMm: "Mép dán (mm)",
      bottomFoldMm: "Gấp đáy (mm)",
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
      atMost: (max: number) => `Tối đa ${max} mm.`,
      /** Ly côn: góc của dải in trải phẳng cộng mép dán phải dưới một vòng (BE `SeamOverlaps`). */
      seamOverlaps: (limit: string) =>
        `Mép dán phải ngắn hơn ${limit}: dài hơn thì dải in trải phẳng của ly chồng lên chính nó.`,
      /** Ly côn: tràn lề không vượt qua bán kính trong của dải in trải phẳng (BE `BleedPastCentre`). */
      bleedPastCentre: (limit: string) =>
        `Tràn lề phải nhỏ hơn ${limit}: lớn hơn thì vượt qua tâm của dải in trải phẳng.`,
      /** Hai lề an toàn phải để lại chỗ in theo cả hai chiều của vùng in (BE `NoSafeArea`). */
      noSafeArea: (limit: string) =>
        `Lề an toàn phải nhỏ hơn ${limit} (một nửa cạnh ngắn nhất của vùng in), nếu không vùng in không còn chỗ in.`,
      /** Túi: chiều cao gửi lên là mặt in cộng gập miệng, tối đa 2000 mm. */
      bagTooTall: (limit: string, max: number) =>
        `Gập miệng tối đa ${limit}: mặt túi cộng gập miệng không được quá ${max} mm.`,
      glueFlapMax: (max: number) => `Tối đa ${max} mm.`,
      bottomFoldMax: (gusset: string) => `Không sâu hơn hông túi (${gusset}).`,
    },
  },
  /** "Ràng buộc file": giới hạn file khách được tải lên (BE `PrintConfigRules`), sửa được cùng số mặc định. */
  fileRules: {
    title: "Ràng buộc file",
    note: "Giới hạn file ảnh mà khách được tải lên khi thiết kế trên cấu hình in này. Studio nhắc khách theo các giá trị này.",
    fields: {
      minDpi: "Độ phân giải tối thiểu (dpi)",
      colorMode: "Hệ màu",
      allowedFileFormats: "Định dạng ảnh khách được tải lên",
      maxFileSizeMb: "Dung lượng tối đa mỗi ảnh (MB)",
      maxColors: "Số màu mực tối đa",
      allowedFontCodes: "Font được dùng",
    },
    colorModes: { CMYK: "CMYK (in offset)", RGB: "RGB" },
    formats: { "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WebP" },
    noColorLimit: "Không giới hạn",
    fontsAll: "Mọi font",
    fontsOnly: "Chỉ các font được chọn",
    fontsGroup: "Danh sách font",
    /** Mã font đã lưu mà danh sách của BE không có (BE-18): hiện lại để người dùng thấy và bỏ chọn được. */
    fontUnknown: (code: string) => `${code} (mã lạ)`,
    fontsLoading: "Đang tải danh sách font…",
    fontsError: "Không tải được danh sách font.",
    fontsRetry: "Thử lại",
    validation: {
      number: "Nhập một số.",
      integer: "Nhập một số nguyên.",
      between: (min: number, max: number) => `Từ ${min} đến ${max}.`,
      formatsNeeded: "Chọn ít nhất một định dạng.",
      fontsNeeded: "Chọn ít nhất một font, hoặc chọn Mọi font.",
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
    glueFlapMm: "Mép dán",
    bottomFoldMm: "Gấp đáy",
  },
  bagSheet: {
    title: "Tấm trải phẳng",
    description:
      "File in của túi là một tấm liền: mép dán, bốn mặt, gập miệng và gấp đáy. Hình vẽ lại theo số trong form.",
    assumption: "Mép dán và gấp đáy điền sẵn là số tạm, chờ xưởng xác nhận khuôn thật.",
    unusable: "Nhập đủ các số hợp lệ để xem tấm trải phẳng.",
    figure: (trim: string, bleed: string) => `Tấm trải phẳng ${trim}, có tràn lề ${bleed}`,
    trim: "Thành phẩm (đường bế)",
    bleedBox: "Có tràn lề",
    columns: "Cột (trái sang phải)",
    rows: "Hàng (trên xuống dưới)",
    glueFlap: "Mép dán",
    topFold: "Gập miệng",
    printed: "Mặt in",
    bottomFold: "Gấp đáy",
    size: (width: string, height: string) => `${width} × ${height}`,
    part: (name: string, size: string) => `${name} ${size}`,
  },
  readOnly: {
    permission: "Bạn không có quyền sửa cấu hình in, nên chỉ xem được.",
    product: "Sản phẩm đã ngừng kinh doanh nên chưa sửa được cấu hình in.",
    variant: "Biến thể này đã ngừng dùng nên không sửa được cấu hình in.",
  },
  status: {
    activateNote: "Kích hoạt: khách hàng của biến thể này bắt đầu thiết kế trên cấu hình in này.",
    activateTitle: "Kích hoạt cấu hình in?",
    activateDescription:
      "Khách hàng của biến thể này sẽ bắt đầu thiết kế trên cấu hình in này. Cấu hình đang dùng trước đó (nếu có) sẽ tự ngừng dùng.",
    deactivateTitle: "Ngừng dùng cấu hình in?",
    deactivateDescription:
      "Khách hàng sẽ không bắt đầu thiết kế mới trên cấu hình in này. Bản thiết kế đang làm dở vẫn giữ cấu hình này.",
    /** Chưa kích hoạt được vì file 3D (BE 409 / 422 khi kích hoạt). */
    activateBlocked: {
      "no-model":
        "Chưa kích hoạt được: cấu hình cũ chưa có số đo từ model 3D. Tải file .glb lên rồi lưu trước.",
      "no-file":
        "Chưa kích hoạt được: cấu hình chưa có file 3D. Tải file .glb lên cùng số đo rồi lưu trước.",
      "mapping-broken":
        "Chưa kích hoạt được: file 3D đang lưu chưa có đủ mesh print:<mã vùng in>. Tải lại file .glb đúng rồi lưu trước.",
    },
  },
  /** Tình trạng file 3D của cấu hình đang lưu, và những gì còn sửa được (luật BE `ModelFileRules`). */
  fileState: {
    noModelTitle: "Cấu hình cũ chưa có số đo từ model 3D",
    noModelBody:
      "Cấu hình này chưa có số đo nên chưa lưu thay đổi hay kích hoạt được. Hãy tải file .glb lên: hệ thống đo file rồi lưu số đo cùng file.",
    noFileTitle: "Cấu hình cũ chưa có file 3D",
    noFileBody:
      "Khi chưa có file, chỉ sửa được tên, giới hạn tải lên, lề an toàn, tràn lề, mép dán, vành miệng ly, gập miệng túi, chất liệu và quai. Số đo, loại sản phẩm và bảng ghép chỉ đổi được khi tải file .glb lên cùng số đo. Chưa có file thì chưa kích hoạt được.",
    brokenTitle: "File 3D đang lưu không khớp các vùng in",
    brokenBody:
      "Hệ thống chặn mọi thay đổi của cấu hình này, kể cả chỉ đổi số mặc định, và chưa kích hoạt được cho tới khi bạn tải lại file .glb có mesh print:<mã vùng in> cho từng vùng in.",
  },
  unreadableTitle: "Không đọc được file",
  serverField: "Máy chủ không chấp nhận giá trị này.",
  save: {
    confirmTitle: "Lưu cấu hình in?",
    confirmDescription: "Cấu hình in này đang có sẵn, bản lưu sẽ thay các giá trị hiện tại.",
    saving: "Đang lưu…",
    nothingToSave: "Chưa có thay đổi để lưu.",
    newFile: (name: string) => `Sẽ lưu cùng file ${name}.`,
    defaultsOnly: "Chỉ đổi số mặc định: file 3D và số đo đang lưu được giữ nguyên.",
    freeFieldsOnly:
      "Chỉ lưu các giá trị sửa được khi chưa có file; số đo đang lưu được giữ nguyên.",
    fileNeeded: "Cần chọn file .glb để lưu cấu hình này.",
    failedTitle: "Không lưu được cấu hình in",
  },
  newConfig: {
    cup: { code: "CUP-BODY", name: "Thân ly" },
    bag: { code: "BAG-FACES", name: "Bốn mặt túi" },
  },
} as const;

/**
 * Cảnh báo "N thiết kế đang chờ duyệt sẽ không duyệt được nữa", và khi nào hiện: MỘT chỗ duy nhất.
 *
 * BE (phiên bản in, cần quyết 1): chỉ đổi trường thuộc phiên bản in mới làm thiết kế đang chờ không duyệt được; kích
 * hoạt, ngừng và gắn file khuôn tham chiếu thì không. Nên chỉ `save` còn hiện, và chỉ khi form đổi một trường in
 * (`changesPrintVersion`) và `pendingReviewCount > 0` của cấu hình. Các dòng khác giữ ở đây với `show: false` (đừng
 * xoá: `PendingWarningAction` suy ra từ các khoá này).
 */
export const PRINT_CONFIG_PENDING_WARNING = {
  /** Câu cảnh báo kèm số thiết kế đang chờ duyệt trên cấu hình. */
  count: (pendingCount: number) =>
    `${pendingCount} thiết kế đang chờ duyệt dùng cấu hình này sẽ không duyệt được nữa (khách phải gửi lại).`,
  /** Hành động nào còn hiện cảnh báo. */
  when: {
    save: { show: true },
    activate: { show: false },
    deactivate: { show: false },
    attachReference: { show: false },
  },
} as const;

export type PendingWarningAction = keyof typeof PRINT_CONFIG_PENDING_WARNING.when;

/**
 * Câu cảnh báo của một hành động, hoặc `null` khi không cần. Lưu chỉ cảnh báo khi cấu hình đã có (`hasStored`: cấu
 * hình mới chưa có thiết kế nào dùng), form đổi một trường thuộc phiên bản in (`printVersionChanged`) và có thiết kế
 * đang chờ duyệt (`pendingReviewCount > 0`).
 */
export function pendingDesignWarning(
  action: PendingWarningAction,
  {
    hasStored,
    pendingReviewCount,
    printVersionChanged = false,
  }: { hasStored: boolean; pendingReviewCount: number | null; printVersionChanged?: boolean },
): string | null {
  if (!PRINT_CONFIG_PENDING_WARNING.when[action].show) return null;
  if (action === "save" && !(hasStored && printVersionChanged)) return null;
  if (!pendingReviewCount || pendingReviewCount <= 0) return null;
  return PRINT_CONFIG_PENDING_WARNING.count(pendingReviewCount);
}

/** Chữ của trang "Cấu hình in" của một biến thể (`/admin/products/[id]/variants/[variantId]/print-config`). */
export const PRINT_CONFIG_PAGE_LABELS = {
  /** Tiêu đề cho screen reader (trang không hiện title) và chữ breadcrumb của trang. */
  pageTitle: "Cấu hình in",
  /** Dòng của thẻ "Thông tin chung": tên biến thể ở đây vì trang không có tiêu đề; tên sản phẩm là link về sản phẩm. */
  general: {
    sku: "SKU",
    variantName: "Tên biến thể",
    product: "Sản phẩm",
    variantStatus: "Trạng thái biến thể",
  },
  /**
   * Biến thể chưa có đơn vị đóng gói (thùng): khách vẫn mở studio nhưng preflight `CARTON_SPEC_MISSING` chặn gửi
   * duyệt, và khách không tự sửa được. Báo ở đây, nơi nhân viên kích hoạt cấu hình in.
   */
  cartonMissing: {
    title: "Biến thể chưa có quy cách thùng.",
    description:
      "Khách vẫn thiết kế được nhưng không gửi duyệt được cho tới khi biến thể có đơn vị thùng. Khai báo ở panel biến thể của sản phẩm:",
    link: "mở sản phẩm",
  },
  notCustomizable: {
    title: "Sản phẩm này không có cấu hình in",
    description:
      "Cấu hình in chỉ áp dụng cho sản phẩm tuỳ chỉnh / in ấn. Sản phẩm tiêu chuẩn được bán nguyên mẫu nên không cần file model 3D.",
  },
  noAccess: {
    title: "Bạn không có quyền xem cấu hình in",
    description:
      "Cấu hình in cần quyền riêng, ngoài quyền xem sản phẩm. Liên hệ quản trị viên nếu bạn cần mở trang này.",
  },
  permissionsFailed: {
    title: "Không tải được quyền của bạn",
    description:
      "Chưa kiểm tra được bạn có quyền xem cấu hình in hay không. Kiểm tra kết nối rồi thử lại.",
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
