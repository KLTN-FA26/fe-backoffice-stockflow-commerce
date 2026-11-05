/**
 * QC dòng nhận — Input schemas (BE `MoveToQcRequest`, `QcDecisionRequest`; docs 03 bước 7–9, BR-08).
 * BE vẫn là nơi chặn cuối — FE chặn sớm để báo lỗi inline (Backend phải re-check BR-08).
 */

import { z } from "zod";

import {
  QC_OUTCOME_API,
  RECEIPT_CARTON_FIELD_MESSAGES as CARTON,
  RECEIPT_FIELD_MESSAGES as MSG,
  RECEIPT_LIMITS,
} from "@/constants";

import { locationCodeInput } from "./input-schemas";

import type { QcOutcomeApi } from "@/constants";

export const moveToQcInputSchema = z.object({
  qcLocationCode: locationCodeInput,
});

const qcQuantity = z.number({ message: MSG.qcQuantity }).int(MSG.qcQuantity).min(0, MSG.qcQuantity);

const qcPartInput = z.object({
  quantity: qcQuantity,
  locationCode: z.string().trim().max(RECEIPT_LIMITS.codeMax, MSG.tooLong).default(""),
  reason: z.string().trim().max(RECEIPT_LIMITS.qcReasonMax, MSG.tooLong).default(""),
});

/** Dòng cần kết luận: SL, phần lẻ và các thùng (SCRUM-473 — thùng tính nguyên thùng theo `receivedQty`). */
export interface QcLine {
  quantity: number;
  looseQuantity: number;
  packages: readonly { lpn: string; receivedQty: number }[];
}

const PART_OUTCOME = { quarantined: "QUARANTINE", rejected: "REJECTED" } as const;

/**
 * Kết luận QC cho một dòng đã ở khu QC. `accepted`, `quarantined.quantity`, `rejected.quantity` là phần LẺ;
 * `cartons[lpn]` là kết luận của từng thùng (mặc định Đạt). Dòng không có thùng: phần lẻ = cả dòng, như trước.
 */
export function buildQcDecisionSchema(line: QcLine) {
  const hasCartons = line.packages.length > 0;
  return z
    .object({
      accepted: qcQuantity,
      quarantined: qcPartInput,
      rejected: qcPartInput,
      cartons: z.record(z.string(), z.enum(QC_OUTCOME_API)).default({}),
    })
    .superRefine(({ accepted, quarantined, rejected, cartons }, issue) => {
      // BR-08 (docs 03 §6) + SCRUM-473 §5: Accepted + Quarantine + Rejected = SL dòng; thùng đi nguyên thùng
      // (tính theo receivedQty) nên phần lẻ của ba phần phải đúng bằng SL lẻ của dòng
      if (accepted + quarantined.quantity + rejected.quantity !== line.looseQuantity) {
        issue.addIssue({
          code: "custom",
          path: ["accepted"],
          message: hasCartons ? CARTON.qcLooseSum(line.looseQuantity) : MSG.qcSum,
        });
      }
      const withGoods = (key: keyof typeof PART_OUTCOME, part: { quantity: number }) =>
        part.quantity > 0 ||
        line.packages.some((carton) => cartons[carton.lpn] === PART_OUTCOME[key]);
      // BR-08: phần Quarantine / Rejected có hàng (lẻ hoặc thùng) bắt buộc có lý do và khu cách ly nhận hàng
      for (const key of ["quarantined", "rejected"] as const) {
        const part = key === "quarantined" ? quarantined : rejected;
        if (!withGoods(key, part)) continue;
        if (!part.locationCode) {
          issue.addIssue({
            code: "custom",
            path: [key, "locationCode"],
            message: MSG.qcLocationRequired,
          });
        }
        if (!part.reason) {
          issue.addIssue({ code: "custom", path: [key, "reason"], message: MSG.qcReasonRequired });
        }
      }
      // BE: một lô không thể vừa QUARANTINE vừa BLOCKED ở cùng một vị trí (GoodsReceiptServiceImpl#inspect)
      if (
        withGoods("quarantined", quarantined) &&
        withGoods("rejected", rejected) &&
        quarantined.locationCode &&
        quarantined.locationCode.toUpperCase() === rejected.locationCode.toUpperCase()
      ) {
        issue.addIssue({
          code: "custom",
          path: ["rejected", "locationCode"],
          message: MSG.qcSameLocation,
        });
      }
    });
}

/** Kết luận mặc định của các thùng: Đạt (BE: thùng không được nêu tên thuộc phần Accepted). */
export function defaultCartonOutcomes(
  line: Pick<QcLine, "packages">,
): Record<string, QcOutcomeApi> {
  return Object.fromEntries(line.packages.map((carton) => [carton.lpn, "ACCEPTED" as const]));
}
