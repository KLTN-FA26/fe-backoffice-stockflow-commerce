/**
 * Lỗi BE của "Ước tính thử" → câu tiếng Việt. Rẽ nhánh theo `errorCode` ổn định (không theo message tiếng Anh);
 * `VALIDATION_FAILED` nêu dòng sai bằng ô `lines[<i>].<trường>` — chỉ ra "dòng thứ i+1" của danh sách.
 */

import { TRIAL_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

const MESSAGES = TRIAL_LABELS.errorMessages;
type CodedMessage = Exclude<keyof typeof MESSAGES, "generic" | "lineInvalid">;

const isCodedMessage = (code: string): code is CodedMessage =>
  code !== "generic" && code !== "lineInvalid" && Object.hasOwn(MESSAGES, code);

const LINE_FIELD = /^lines\[(\d+)\]/;

/** Dòng (đếm từ 1) của danh sách mà BE chê, nếu có. */
export function invalidTrialLine(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_FAILED") return null;
  for (const field of Object.keys(error.fieldErrors ?? {})) {
    const index = LINE_FIELD.exec(field)?.[1];
    if (index !== undefined) return Number(index) + 1;
  }
  return null;
}

export function trialErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  const line = invalidTrialLine(error);
  if (line !== null) return MESSAGES.lineInvalid(line);
  if (isCodedMessage(error.code)) return MESSAGES[error.code];
  if (error.status === 403) return MESSAGES.FORBIDDEN;
  return MESSAGES.generic;
}
