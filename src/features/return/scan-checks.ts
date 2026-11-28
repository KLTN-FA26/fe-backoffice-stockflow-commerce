import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_RECEIVING_LABELS } from "@/constants/labels-return-receiving";

import type { CandidateCarton } from "./types";

const D = RETURN_RECEIPT_LABELS.detail;
const S = RETURN_RECEIVING_LABELS.selected;

/** Số đếm của thùng đã mở: số nguyên ≥ 0, không vượt nhãn khi biết thùng (BE `ScanReturnCartonRequest`). */
export function countedProblem(raw: string, label: number | undefined): string | null {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(value) || value < 0) return D.countedRequired;
  return label !== undefined && value > label ? D.countedAboveLabel : null;
}

/**
 * Trước khi gửi, với thùng ứng viên của phiếu RMA (BE `candidateCartons`, chỉ là gợi ý — BE vẫn quyết): thùng phải mở đếm
 * thì không gửi nguyên thùng; số đếm không vượt số còn nhận được.
 */
export function candidateProblem(
  candidate: CandidateCarton | undefined,
  opened: boolean,
  counted: number,
): string | null {
  if (
    !candidate ||
    (candidate.eligibility !== "RECEIVABLE" && candidate.eligibility !== "COUNT_REQUIRED")
  )
    return null;
  if (!opened && candidate.eligibility === "COUNT_REQUIRED")
    return S.sealedNotAllowed(candidate.maxReceivableQuantity);
  return opened && counted > candidate.maxReceivableQuantity
    ? S.countedAboveMax(candidate.maxReceivableQuantity)
    : null;
}
