/**
 * "Ước tính thử" (SCRUM-474 TRIAL-FLOW 29/10, LP2-9): tải file Excel mẫu EasyCargo, chạy thử xếp xe, KHÔNG lưu gì.
 * Bảng tên cột / đơn vị bên dưới chép từ `nesting-standalone/api/nesting/parsers.py` (`_HEADER_ALIASES`,
 * `_LENGTH_FACTORS`, `_FALSEY`) — parser FE phải đọc file giống hệt bản Python (quyết định 29/10: "parse exactly like
 * parsers.py"). `constants/` là tầng thấp nhất: không import gì ngoài chính nó.
 */

/** Trường chuẩn của một dòng file mẫu. */
export const TRIAL_FIELDS = [
  "group",
  "description",
  "pieces",
  "length",
  "width",
  "height",
  "rotable",
] as const;
export type TrialField = (typeof TRIAL_FIELDS)[number];

/**
 * `_HEADER_ALIASES`: tên cột (không phân biệt hoa thường, gộp khoảng trắng) khớp khi BẰNG hoặc BẮT ĐẦU bằng một bí danh.
 * Thứ tự bí danh và thứ tự trường giữ nguyên như bản Python.
 */
export const TRIAL_HEADER_ALIASES: Readonly<Record<TrialField, readonly string[]>> = {
  group: ["group"],
  description: ["description", "desc", "name", "item"],
  pieces: ["pieces", "piece", "pcs", "qty", "quantity", "count"],
  length: ["length", "len"],
  width: ["width"],
  height: ["height"],
  rotable: ["rotable", "rotatable", "rotate", "rotation"],
};

/** Header hợp lệ phải có đủ các cột này (`_build_header_map`). */
export const TRIAL_REQUIRED_FIELDS = ["pieces", "length", "width", "height"] as const;

/** `_LENGTH_FACTORS`: chuỗi trong dòng đơn vị → hệ số ra mm. Thứ tự QUAN TRỌNG ("centimet" trước "meter"). */
export const TRIAL_LENGTH_UNITS: readonly (readonly [token: string, factor: number])[] = [
  ["millimet", 1],
  ["mm", 1],
  ["centimet", 10],
  ["cm", 10],
  ["meter", 1000],
  ["metre", 1000],
  ["inch", 25.4],
  ['"', 25.4],
];

/** Không có dòng đơn vị: cm, mặc định của file mẫu EasyCargo. */
export const TRIAL_DEFAULT_LENGTH_FACTOR = 10;

/** `length_unit` của bản Python, theo hệ số (nhãn tiếng Việt cho màn xem trước). */
export const TRIAL_LENGTH_UNIT_LABELS: Readonly<Record<number, string>> = {
  1: "milimét",
  10: "xentimét",
  1000: "mét",
  25.4: "inch",
};

/** `_FALSEY`: giá trị cột Rotable nghĩa là "không xoay"; ô trống = xoay được (mặc định). */
export const TRIAL_FALSE_VALUES: readonly string[] = [
  "n",
  "no",
  "false",
  "0",
  "f",
  "không",
  "khong",
];

/** BE `TrialLoadEstimateRequest.Line`: `@Size(max = 200)` tên, `@Size(max = 100)` nhóm; kích thước tối đa 100 000 mm. */
export const TRIAL_NAME_MAX = 200;
export const TRIAL_GROUP_MAX = 100;
export const TRIAL_MAX_MM = 100_000;

/** Giới hạn thùng của một lần ước tính: BE `EstimateCartons.MAX_BOXES` (cùng giới hạn với ước tính thật). */
export const TRIAL_MAX_BOXES = 3000;

/** File mẫu trong `public/` và tên khi tải về. */
export const TRIAL_TEMPLATE = {
  href: "/templates/easycargo-trial-template.xlsx",
  downloadName: "uoc-tinh-thu-mau.xlsx",
} as const;

/** Chỉ nhận .xlsx (`read-excel-file` không đọc .xls cũ). */
export const TRIAL_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Chặn file quá lớn trước khi đọc trong trình duyệt (một file mẫu hàng nghìn dòng chỉ vài trăm KB). */
export const TRIAL_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const TRIAL_LABELS = {
  pageTitle: "Ước tính thử",
  badge: "Chạy thử — không lưu",
  intro:
    "Tải file Excel danh sách kiện theo mẫu EasyCargo để xem thử các kiện xếp lên xe thế nào. Kết quả chỉ để xem: không lưu ước tính, không gắn với đơn hay kế hoạch nào, và không kiểm tra tải trọng (file không có khối lượng).",
  noPermission: "Bạn không có quyền ước tính xếp xe.",
  upload: {
    title: "1. Chọn file Excel",
    hint: "File .xlsx theo mẫu EasyCargo: cột Group, Description, Pieces, Length, Width, Height, Rotable. Cột khối lượng không được đọc.",
    choose: "Chọn file .xlsx",
    chooseAnother: "Chọn file khác",
    template: "Tải file mẫu",
    reading: "Đang đọc file…",
    fileName: (name: string) => `File: ${name}`,
  },
  errors: {
    notXlsx: "Chỉ nhận file .xlsx.",
    tooBig: "File quá lớn (tối đa 5 MB).",
    unreadable: "Không đọc được file. Hãy kiểm tra đó là file .xlsx hợp lệ.",
    noHeader:
      "Không tìm thấy dòng tiêu đề có các cột Pieces, Length, Width, Height. Hãy dùng đúng file mẫu.",
    noRows: "Không có dòng hàng hợp lệ dưới dòng tiêu đề.",
  },
  warnings: {
    title: (count: number) => `Đã bỏ qua ${count} dòng`,
    piecesMissing: (row: number) => `Dòng ${row}: bỏ qua — thiếu Pieces hoặc bằng 0.`,
    nonPositive: (row: number) => `Dòng ${row}: bỏ qua — có kích thước bằng 0 hoặc âm.`,
  },
  preview: {
    title: "2. Kiểm tra danh sách kiện",
    summary: (rows: number, pieces: number, groups: number, unit: string) =>
      `${rows} dòng · ${pieces} kiện · ${groups} nhóm · đơn vị trong file: ${unit}`,
    caption: "Danh sách kiện đọc từ file",
    name: "Tên",
    group: "Nhóm",
    quantity: "Số kiện",
    length: "Dài (mm)",
    width: "Rộng (mm)",
    height: "Cao (mm)",
    rotatable: "Xoay được",
    yes: "Có",
    no: "Không",
    noGroup: "—",
    overCap: (pieces: number, max: number) =>
      `File có ${pieces} kiện, vượt giới hạn ${max} kiện một lần ước tính. Hãy chia file.`,
  },
  run: {
    title: "3. Chọn xe và chạy thử",
    run: "Chạy thử",
    rerun: "Chạy thử lại",
    running: "Đang tính…",
    blockedOverCap: "Số kiện vượt giới hạn — chia file rồi chọn lại.",
  },
  result: {
    title: "Kết quả chạy thử",
    hint: "Kết quả này không được lưu: tải lại trang hoặc chọn file khác là mất. Khối lượng không có trong file nên không kiểm tra tải trọng xe.",
  },
  /** Mã lỗi BE của `POST /fulfillment/load-estimates/trial` → câu tiếng Việt. */
  errorMessages: {
    LOAD_ESTIMATE_TOO_MANY_CARTONS: `Quá nhiều kiện cho một lần ước tính (tối đa ${TRIAL_MAX_BOXES}). Hãy chia file.`,
    VEHICLE_TYPE_INACTIVE: "Có loại xe đã ngừng dùng — bỏ chọn loại đó rồi thử lại.",
    VEHICLE_TYPE_NOT_FOUND: "Có loại xe không còn tồn tại — chọn lại loại xe.",
    FORBIDDEN: "Bạn không có quyền ước tính xếp xe.",
    VALIDATION_FAILED: "Dữ liệu không hợp lệ. Kiểm tra lại file và loại xe.",
    lineInvalid: (line: number) =>
      `Dòng thứ ${line} trong danh sách không hợp lệ (kích thước hoặc số kiện không đúng giới hạn).`,
    NETWORK_ERROR: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
    generic: "Không chạy thử được. Vui lòng thử lại.",
  },
} as const;
