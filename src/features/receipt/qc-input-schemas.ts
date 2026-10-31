/**
 * QC dòng nhận — Input schemas (BE `MoveToQcRequest`, `QcDecisionRequest`; docs 03 bước 7–9, BR-08).
 * BE vẫn là nơi chặn cuối — FE chặn sớm để báo lỗi inline (Backend phải re-check BR-08).
 */

import { z } from "zod";

import { RECEIPT_FIELD_MESSAGES as MSG, RECEIPT_LIMITS } from "@/constants";

import { locationCodeInput } from "./input-schemas";

export const moveToQcInputSchema = z.object({
  qcLocationCode: locationCodeInput,
});

const qcQuantity = z.number({ message: MSG.qcQuantity }).int(MSG.qcQuantity).min(0, MSG.qcQuantity);

const qcPartInput = z.object({
  quantity: qcQuantity,
  locationCode: z.string().trim().max(RECEIPT_LIMITS.codeMax, MSG.tooLong).default(""),
  reason: z.string().trim().max(RECEIPT_LIMITS.qcReasonMax, MSG.tooLong).default(""),
});

/** Kết luận QC cho một dòng đã ở khu QC; `movedQuantity` = SL đã chuyển sang khu QC. */
export function buildQcDecisionSchema(movedQuantity: number) {
  return z
    .object({ accepted: qcQuantity, quarantined: qcPartInput, rejected: qcPartInput })
    .superRefine(({ accepted, quarantined, rejected }, issue) => {
      // BR-08 (docs 03 §6): Accepted + Quarantine + Rejected = SL đã chuyển sang khu QC
      if (accepted + quarantined.quantity + rejected.quantity !== movedQuantity) {
        issue.addIssue({ code: "custom", path: ["accepted"], message: MSG.qcSum });
      }
      // BR-08: phần Quarantine / Rejected bắt buộc có lý do (và khu cách ly nhận hàng)
      for (const key of ["quarantined", "rejected"] as const) {
        const part = key === "quarantined" ? quarantined : rejected;
        if (part.quantity === 0) continue;
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
        quarantined.quantity > 0 &&
        rejected.quantity > 0 &&
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
