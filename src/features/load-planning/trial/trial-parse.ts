/**
 * Đọc bảng EasyCargo trong trình duyệt cho "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9) — bản port TỪNG BƯỚC của
 * `nesting-standalone/api/nesting/parsers.py` (`parse_box_workbook`), chỉ nhận mảng dòng đã đọc (thuần, không file):
 *
 *   Group → group · Description → name · Pieces → quantity · Length → lengthMm (dọc xe, "depth" của solver) ·
 *   Width → widthMm · Height → heightMm · Rotable → rotatable (ô trống = xoay được). Cột khối lượng, Stackable,
 *   Tiltable KHÔNG đọc (solver Python không ràng buộc khối lượng).
 *
 * Giống bản Python: cột map theo TÊN tiêu đề; dòng ngay dưới tiêu đề là dòng đơn vị (mm / cm / m / inch, mặc định cm);
 * dòng thiếu Length/Width/Height bị bỏ im lặng (dòng đơn vị, dòng trống); dòng Pieces 0 hoặc kích thước ≤ 0 bị bỏ KÈM
 * cảnh báo. Khác Python đúng một chỗ kỹ thuật: BE nhận mm nguyên, nên kích thước làm tròn tới mm (tối thiểu 1).
 * Giá trị ô kiểu ngày coi là không phải số (Python sẽ nhặt số năm trong chuỗi ngày — vô nghĩa).
 */

import {
  TRIAL_DEFAULT_LENGTH_FACTOR,
  TRIAL_FALSE_VALUES,
  TRIAL_FIELDS,
  TRIAL_GROUP_MAX,
  TRIAL_HEADER_ALIASES,
  TRIAL_LENGTH_UNIT_LABELS,
  TRIAL_LENGTH_UNITS,
  TRIAL_NAME_MAX,
  TRIAL_REQUIRED_FIELDS,
} from "@/constants";

import type { TrialField } from "@/constants";

export type TrialCell = string | number | boolean | Date | null | undefined;
export type TrialRow = readonly TrialCell[];

/**
 * Dòng thô của thư viện đọc xlsx → `TrialCell`. Thư viện khai báo kiểu ô ngày là `typeof Date` (hàm dựng) dù giá trị
 * thật là `Date`, nên chuẩn lại từng ô thay vì ép kiểu; ô lạ → null.
 */
export function normalizeRows(rows: readonly (readonly unknown[])[]): TrialCell[][] {
  return rows.map((row) =>
    row.map((value): TrialCell => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
      return value instanceof Date ? value : null;
    }),
  );
}

/** Một dòng hàng của danh sách chạy thử: đúng dạng BE `TrialLoadEstimateRequest.Line`. */
export interface TrialLine {
  name: string;
  group: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  rotatable: boolean;
  /** Số dòng trong file (đếm từ 1), để báo lỗi dẫn về đúng dòng. */
  sourceRow: number;
}

/** Dòng bị bỏ: Pieces thiếu / 0 (chỉ báo khi dòng có dữ liệu), hoặc có kích thước ≤ 0 (`warnings` của Python). */
export interface TrialSkippedRow {
  row: number;
  reason: "PIECES_MISSING" | "NON_POSITIVE";
}

export interface TrialParseResult {
  lines: TrialLine[];
  skipped: TrialSkippedRow[];
  summary: { rows: number; groups: number; totalPieces: number; unitLabel: string };
}

export type TrialParseErrorCode = "NOT_XLSX" | "TOO_BIG" | "UNREADABLE" | "NO_HEADER" | "NO_ROWS";

export class TrialParseError extends Error {
  readonly code: TrialParseErrorCode;
  constructor(code: TrialParseErrorCode) {
    super(code);
    this.name = "TrialParseError";
    this.code = code;
  }
}

/** `_norm`: gộp khoảng trắng / xuống dòng, cắt hai đầu, chữ thường. */
const norm = (value: TrialCell): string =>
  value === null || value === undefined
    ? ""
    : String(value).replace(/\s+/g, " ").trim().toLowerCase();

/** `_clean_text`: như `norm` nhưng giữ nguyên hoa thường. */
const cleanText = (value: TrialCell): string =>
  value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim();

/** `_to_float`: số thường, dấu phẩy thập phân kiểu EU, đơn vị thừa ("90 cm"); không phải số → null. */
function toFloat(value: TrialCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return Number(value);
  if (value instanceof Date) return null;
  let text = value.trim();
  if (!text) return null;
  text =
    text.includes(",") && !text.includes(".") ? text.replace(/,/g, ".") : text.replace(/,/g, "");
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  return match ? Number(match[0]) : null;
}

/** `_to_bool`: ô trống → mặc định; "n/no/false/0/f/không/khong" → false; còn lại → true. */
function toBool(value: TrialCell, fallback: boolean): boolean {
  const text = norm(value);
  return text === "" ? fallback : !TRIAL_FALSE_VALUES.includes(text);
}

/** `_unit_factor`: bí danh đầu tiên (theo thứ tự bảng) nằm trong chuỗi đơn vị. */
function unitFactor(text: string): number {
  for (const [token, factor] of TRIAL_LENGTH_UNITS) if (text.includes(token)) return factor;
  return TRIAL_DEFAULT_LENGTH_FACTOR;
}

/** `_build_header_map`: dòng đầu tiên có đủ Pieces/Length/Width/Height; mỗi trường lấy cột đầu tiên khớp. */
function buildHeaderMap(
  rows: readonly TrialRow[],
): { index: number; col: Map<TrialField, number> } | null {
  for (const [index, row] of rows.entries()) {
    const cells = row.map(norm);
    const col = new Map<TrialField, number>();
    for (const field of TRIAL_FIELDS) {
      const aliases = TRIAL_HEADER_ALIASES[field];
      const found = cells.findIndex(
        (cell) => cell !== "" && aliases.some((alias) => cell === alias || cell.startsWith(alias)),
      );
      if (found >= 0) col.set(field, found);
    }
    if (TRIAL_REQUIRED_FIELDS.every((field) => col.has(field))) return { index, col };
  }
  return null;
}

const toMm = (value: number, factor: number): number => Math.max(1, Math.round(value * factor));

/** `parse_box_workbook` trên các dòng đã đọc. Ném `TrialParseError` NO_HEADER / NO_ROWS như `ValueError` của Python. */
export function parseTrialRows(rows: readonly TrialRow[]): TrialParseResult {
  const header = buildHeaderMap(rows);
  if (!header) throw new TrialParseError("NO_HEADER");
  const { index: headerIndex, col } = header;

  const unitRow = rows[headerIndex + 1];
  const factor = unitFactor(unitRow ? unitRow.map(norm).join(" ") : "");
  const cell = (row: TrialRow, field: TrialField): TrialCell => {
    const at = col.get(field);
    return at === undefined ? null : row[at];
  };

  const lines: TrialLine[] = [];
  const skipped: TrialSkippedRow[] = [];
  const groups = new Set<string>();
  let totalPieces = 0;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const length = toFloat(cell(row, "length"));
    const width = toFloat(cell(row, "width"));
    const height = toFloat(cell(row, "height"));
    const pieces = toFloat(cell(row, "pieces"));
    // Dòng đơn vị và dòng trống: không có đủ ba kích thước → bỏ im lặng.
    if (length === null || width === null || height === null) continue;

    const quantity = pieces !== null && pieces > 0 ? Math.trunc(pieces) : 0;
    if (quantity <= 0) {
      if (row.some(Boolean)) skipped.push({ row: i + 1, reason: "PIECES_MISSING" });
      continue;
    }
    if (length <= 0 || width <= 0 || height <= 0) {
      skipped.push({ row: i + 1, reason: "NON_POSITIVE" });
      continue;
    }
    const group = cleanText(cell(row, "group")).slice(0, TRIAL_GROUP_MAX);
    const name = (cleanText(cell(row, "description")) || group || `row-${i + 1}`).slice(
      0,
      TRIAL_NAME_MAX,
    );
    lines.push({
      name,
      group,
      // Length → depth: dọc chiều dài xe (trục z của solver), như `depth_mm <- Length`.
      lengthMm: toMm(length, factor),
      widthMm: toMm(width, factor),
      heightMm: toMm(height, factor),
      quantity,
      rotatable: toBool(cell(row, "rotable"), true),
      sourceRow: i + 1,
    });
    totalPieces += quantity;
    if (group) groups.add(group);
  }

  if (lines.length === 0) throw new TrialParseError("NO_ROWS");
  return {
    lines,
    skipped,
    summary: {
      rows: lines.length,
      groups: groups.size,
      totalPieces,
      unitLabel:
        TRIAL_LENGTH_UNIT_LABELS[factor] ?? TRIAL_LENGTH_UNIT_LABELS[TRIAL_DEFAULT_LENGTH_FACTOR],
    },
  };
}
