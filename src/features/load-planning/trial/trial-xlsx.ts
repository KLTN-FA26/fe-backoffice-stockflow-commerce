/**
 * Đọc file .xlsx của "Ước tính thử" ngay trong trình duyệt (SCRUM-474 TRIAL-FLOW): `read-excel-file` (MIT, nhẹ, đọc
 * bằng Web Worker) nạp theo yêu cầu để không vào bundle trang khi chưa chọn file. Dòng đọc ra qua `parseTrialRows`.
 */

import { TRIAL_MAX_FILE_BYTES } from "@/constants";

import { normalizeRows, parseTrialRows, TrialParseError } from "./trial-parse";

import type { TrialCell, TrialParseResult } from "./trial-parse";

/** Sheet đầu tiên của file (file mẫu EasyCargo chỉ có một sheet). */
export async function readTrialFile(file: File): Promise<TrialParseResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new TrialParseError("NOT_XLSX");
  if (file.size > TRIAL_MAX_FILE_BYTES) throw new TrialParseError("TOO_BIG");
  let rows: TrialCell[][];
  try {
    const { readSheet } = await import("read-excel-file/browser");
    rows = normalizeRows(await readSheet(file));
  } catch {
    throw new TrialParseError("UNREADABLE");
  }
  return parseTrialRows(rows);
}
