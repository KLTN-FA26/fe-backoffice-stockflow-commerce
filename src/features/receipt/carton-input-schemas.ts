/**
 * Chia thùng trên dòng kiểm đếm — Input zod (BE `ReceiptLinesRequest.Line.unitOfMeasure` / `.packages`, SCRUM-473).
 * BE vẫn là nơi chặn cuối (Backend phải re-check — `GoodsReceiptServiceImpl#cartonUnit`); FE chặn sớm để báo inline.
 */

import { z } from "zod";

import {
  RECEIPT_CARTON_FIELD_MESSAGES as CARTON,
  RECEIPT_CARTON_LIMITS,
  RECEIPT_FIELD_MESSAGES as MSG,
} from "@/constants";

import { countedIntoCartons } from "./carton-selectors";

/**
 * Một thùng: `lpn` rỗng = thùng mới (BE cấp LPN khi lưu); có `lpn` = đếm lại thùng đó.
 * SCRUM-473 §3 rule 4: mỗi thùng ít nhất 1 đơn vị.
 */
export const packageInputSchema = z.object({
  lpn: z.string().trim().max(RECEIPT_CARTON_LIMITS.lpnMax, MSG.tooLong).default(""),
  quantity: z
    .number({ message: CARTON.cartonQuantity })
    .int(CARTON.cartonQuantity)
    .min(1, CARTON.cartonQuantity),
});

/** Field thùng của một dòng kiểm đếm. Mặc định: dòng lẻ, đơn vị cơ sở, không thùng. */
export const cartonLineFields = {
  unitOfMeasure: z.string().trim().max(RECEIPT_CARTON_LIMITS.unitCodeMax, MSG.tooLong).default(""),
  packages: z
    .array(packageInputSchema)
    .max(RECEIPT_CARTON_LIMITS.cartonsPerLineMax, CARTON.cartonsTooMany)
    .default([]),
};

interface CartonLineValues {
  quantity: number;
  unitOfMeasure: string;
  packages: readonly { lpn: string; quantity: number }[];
}

/** Luật thùng của dòng `index` — gọi trong `superRefine` của schema kiểm đếm (phiếu theo PO và không có PO). */
export function refineLineCartons(
  line: CartonLineValues,
  index: number,
  issue: z.RefinementCtx,
): void {
  if (line.packages.length === 0) return;
  const at = (...path: (string | number)[]) => ["lines", index, ...path];
  // SCRUM-473 §3 rule 3: có thùng thì phải có đơn vị đóng gói của thùng
  if (!line.unitOfMeasure) {
    issue.addIssue({ code: "custom", path: at("unitOfMeasure"), message: CARTON.unitRequired });
  }
  // SCRUM-473 §3 rule 5: Σ thùng ≤ SL dòng — phần còn lại là hàng lẻ
  if (countedIntoCartons(line.packages) > line.quantity) {
    issue.addIssue({ code: "custom", path: at("packages"), message: CARTON.cartonsExceedLine });
  }
  // BE VALIDATION_FAILED `packages[j].lpn`: một LPN chỉ một lần (BE so khớp không phân biệt hoa thường)
  const seen = new Set<string>();
  line.packages.forEach((carton, j) => {
    const lpn = carton.lpn.toUpperCase();
    if (!lpn) return;
    if (seen.has(lpn)) {
      issue.addIssue({
        code: "custom",
        path: at("packages", j, "lpn"),
        message: CARTON.duplicateLpn,
      });
    }
    seen.add(lpn);
  });
}
