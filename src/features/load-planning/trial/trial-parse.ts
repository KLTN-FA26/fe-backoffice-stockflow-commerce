/**
 * Đọc bảng EasyCargo trong trình duyệt cho "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9) — bản port TỪNG BƯỚC của
 * `nesting-standalone/api/nesting/parsers.py` (`parse_box_workbook`), chỉ nhận mảng dòng đã đọc (thuần, không file):
 *
 *   Group → group · Description → name · Pieces → quantity · Length → lengthMm (dọc xe, "depth" của solver) ·
 *   Width → widthMm · Height → heightMm · Rotable → rotatable (ô trống = xoay được). Stackable, Tiltable KHÔNG đọc.
 *
 * Khác Python theo quyết định WF4-TRIAL-EST (18/11): đọc thêm "Total weight" → totalWeightKg (tổng cả dòng; đơn vị
 * theo ô đơn vị dưới cột, mặc định kg) và cột tuỳ chọn "Hàng chèn" → fill (trống = hàng chính). Dòng thiếu khối
 * lượng KHÔNG bị bỏ: được liệt kê ở `missingWeight` và màn khoá nút chạy (docs 09 §6 edge case "kiện thiếu kích
 * thước / khối lượng": chặn tính phương án). File cũ không có cột "Hàng chèn" đọc như cũ (mọi dòng là hàng chính).
 *
 * Giống bản Python: cột map theo TÊN tiêu đề; dòng ngay dưới tiêu đề là dòng đơn vị (mm / cm / m / inch, mặc định cm);
 * dòng thiếu Length/Width/Height bị bỏ im lặng (dòng đơn vị, dòng trống); dòng Pieces 0 hoặc kích thước ≤ 0 bị bỏ KÈM
 * cảnh báo. Khác Python đúng một chỗ kỹ thuật: BE nhận mm nguyên, nên kích thước làm tròn tới mm (tối thiểu 1).
 * Giá trị ô kiểu ngày coi là không phải số (Python sẽ nhặt số năm trong chuỗi ngày — vô nghĩa).
 */

import {
  TRIAL_DEFAULT_LENGTH_FACTOR,
  TRIAL_FIELDS,
  TRIAL_GROUP_MAX,
  TRIAL_HEADER_ALIASES,
  TRIAL_LENGTH_UNIT_LABELS,
  TRIAL_NAME_MAX,
  TRIAL_REQUIRED_FIELDS,
} from "@/constants";

import {
  cleanText,
  norm,
  roundKg,
  toBool,
  toFloat,
  toKg,
  toMm,
  unitFactor,
  weightFactor,
} from "./trial-cells";

import type { TrialField } from "@/constants";
import type { TrialCell, TrialRow } from "./trial-cells";

export { normalizeRows } from "./trial-cells";
export type { TrialCell, TrialRow } from "./trial-cells";

/** Một dòng hàng của danh sách chạy thử: đúng dạng BE `TrialLoadEstimateRequest.Line`. */
export interface TrialLine {
  name: string;
  group: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  /** Tổng khối lượng cả dòng, kg (3 chữ số thập phân như BE); null = ô trống / không dương → chặn chạy thử. */
  totalWeightKg: number | null;
  rotatable: boolean;
  /** Cột "Hàng chèn": hàng phụ, chỉ chế độ PRIORITY_FILL đọc. */
  fill: boolean;
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
  /** Số dòng (trong file) thiếu khối lượng — có dòng nào thì không chạy thử được. */
  missingWeight: number[];
  summary: {
    rows: number;
    groups: number;
    totalPieces: number;
    totalWeightKg: number;
    fillRows: number;
    unitLabel: string;
  };
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
  const kgFactor = weightFactor(unitRow ? norm(cell(unitRow, "weight")) : "");

  const lines: TrialLine[] = [];
  const skipped: TrialSkippedRow[] = [];
  const missingWeight: number[] = [];
  const groups = new Set<string>();
  let totalPieces = 0;
  let totalWeightKg = 0;

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
    const weight = toKg(toFloat(cell(row, "weight")), kgFactor);
    if (weight === null) missingWeight.push(i + 1);
    lines.push({
      name,
      group,
      // Length → depth: dọc chiều dài xe (trục z của solver), như `depth_mm <- Length`.
      lengthMm: toMm(length, factor),
      widthMm: toMm(width, factor),
      heightMm: toMm(height, factor),
      quantity,
      totalWeightKg: weight,
      rotatable: toBool(cell(row, "rotable"), true),
      fill: toBool(cell(row, "fill"), false),
      sourceRow: i + 1,
    });
    totalPieces += quantity;
    totalWeightKg += weight ?? 0;
    if (group) groups.add(group);
  }

  if (lines.length === 0) throw new TrialParseError("NO_ROWS");
  return {
    lines,
    skipped,
    missingWeight,
    summary: {
      rows: lines.length,
      groups: groups.size,
      totalPieces,
      totalWeightKg: roundKg(totalWeightKg),
      fillRows: lines.filter((line) => line.fill).length,
      unitLabel:
        TRIAL_LENGTH_UNIT_LABELS[factor] ?? TRIAL_LENGTH_UNIT_LABELS[TRIAL_DEFAULT_LENGTH_FACTOR],
    },
  };
}
