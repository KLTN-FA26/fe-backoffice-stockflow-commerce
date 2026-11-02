/**
 * Xếp hàng lên xe — hằng số dùng chung của hợp đồng `Layout` và khung 3D
 * (design v2 §5, port từ `nesting-standalone`).
 *
 * `constants/` là tầng thấp nhất: không import gì ngoài chính nó. Màu hex nằm ở đây (không ở
 * `features/`) vì WebGL cần giá trị màu thật, không đọc được CSS variable của Tailwind.
 */

/**
 * Hướng đặt của một kiện — chuỗi 3 chữ cái đọc theo thứ tự của nhãn D×R×C: trục z (dài, về phía
 * cửa xe), trục x (rộng), trục y (lên). Mỗi chữ là kích thước danh định của kiện (`origMm.l/w/h`)
 * đang nằm dọc trục đó. `LWH` = không xoay: dài dọc xe, rộng ngang xe, cao hướng lên.
 */
export const LAYOUT_ORIENTATIONS = ["LWH", "LHW", "WLH", "WHL", "HLW", "HWL"] as const;
export type LayoutOrientation = (typeof LAYOUT_ORIENTATIONS)[number];

/**
 * Mã luật xếp do solver BE quy định (BR-10/BR-11, docs 09-shipping §6) — cũng là `rule` trong
 * `PLACEMENT_RULE_VIOLATION` (`fieldErrors[{field: ref, code: rule}]`; BE PR #161): ngoài lòng thùng, chồng nhau,
 * thiếu đỡ (< 98% đáy), quá tải trọng xe, xoay kiện không được xoay, vướng khối gia cố góc, kiện không lọt cửa
 * xe (`DOOR`), một bộ bị tách khỏi một xe (`KIT_SPLIT`, LP-3), kích thước đã xếp không khớp hướng đặt
 * (`ORIENTATION_MISMATCH`).
 */
export const PLACEMENT_RULES = [
  "OUT_OF_BOUNDS",
  "OVERLAP",
  "UNSUPPORTED",
  "OVERWEIGHT",
  "ROTATION_NOT_ALLOWED",
  "GUSSET",
  "DOOR",
  "KIT_SPLIT",
  "ORIENTATION_MISMATCH",
] as const;
export type PlacementRule = (typeof PLACEMENT_RULES)[number];

/** Bốn góc nhìn nhanh của khung 3D: chéo, từ trên, từ bên hông, từ phía cửa. */
export const VIEW_KINDS = ["iso", "top", "side", "end"] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

/**
 * Bảng màu mỗi mặt hàng trong khung 3D (`PALETTE` của `packing-shared.ts`). Đã thay các màu hồng/
 * magenta của bản gốc (`#f472b6`, `#fb7185`) bằng cam và chanh — luật cứng của repo (CLAUDE.md).
 */
export const VIEWER_PALETTE = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#a3e635",
  "#818cf8",
] as const;

/** Bảng màu nhạt hơn cho ảnh chụp từng bước xếp (in trắng đen vẫn đọc được). */
export const CAPTURE_PALETTE = [
  "#fde047",
  "#7dd3fc",
  "#67e8f9",
  "#c4b5fd",
  "#fb923c",
  "#86efac",
  "#d6b588",
  "#93c5fd",
  "#fcd34d",
  "#6ee7b7",
  "#5eead4",
  "#a5b4fc",
  "#fdba74",
  "#bef264",
] as const;

/** Màu cảnh 3D (khung xe, lưới, khối gia cố, vùng trống, nhãn). */
export const SCENE_COLORS = {
  background: "#f8fafc",
  shellFill: "#e2e8f0",
  shellEdge: "#334155",
  gridMajor: "#94a3b8",
  gridMinor: "#cbd5e1",
  boxEdge: "#ffffff",
  gusset: "#f59e0b",
  gussetEdge: "#b45309",
  emptySpace: "#22d3ee",
  emptySpaceEdge: "#0891b2",
  labelText: "#0f172a",
  captureBackground: "#ffffff",
  captureShellEdge: "#94a3b8",
  captureBoxEdge: "#1e293b",
  /** Trình soạn xếp tay: kiện đang chọn, kiện vi phạm luật, ô gợi ý chỗ đặt. */
  selected: "#2563eb",
  violation: "#dc2626",
  landing: "#16a34a",
  landingEdge: "#15803d",
  /** Màu trộn vào để làm sáng kiện đang rê chuột. */
  hoverMix: "#ffffff",
} as const;
