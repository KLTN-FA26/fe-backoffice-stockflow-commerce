/**
 * Form "Đổi người phụ trách" (kế hoạch sales-owner BR-S03, BR-S04, D3) — dùng ở trang khách và ở "Cần giao người phụ
 * trách" của màn Phân công khách. BE kiểm lại mọi luật (`SALES_OWNER_CHANGE_REASON_REQUIRED`,
 * `SALES_OWNER_NOT_ASSIGNABLE`, `SALES_OWNER_VERSION_CONFLICT`).
 */

import { z } from "zod";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import { SALES_OWNER_LIMITS } from "@/constants/sales-owner";

import type { SalesOwnerChangeReason } from "@/constants/sales-owner";

export interface ChangeSalesOwnerValues {
  salesOwnerId: string;
  reason: string;
  note: string;
  notifyCustomer: boolean;
}

export function changeSalesOwnerSchema({
  reasons,
  currentOwnerId,
}: {
  reasons: readonly SalesOwnerChangeReason[];
  /** Người đang phụ trách (còn làm) — chọn lại chính họ là không đổi gì. */
  currentOwnerId: string | null;
}) {
  return z
    .object({
      salesOwnerId: z.string().min(1, "Chọn Sale phụ trách mới"),
      // BR-S03: lý do bắt buộc khi đổi
      reason: z.string().refine((v) => (reasons as readonly string[]).includes(v), {
        message: "Chọn lý do",
      }),
      note: z.string().trim().max(SALES_OWNER_LIMITS.textMax, "Tối đa 1000 ký tự"),
      // D3: mặc định báo khách; bỏ chọn khi đổi nội bộ
      notifyCustomer: z.boolean(),
    })
    .superRefine((v, ctx) => {
      // BR-S03: "chọn một trong … / Khác, kèm ghi chú" — chọn "Khác" thì phải ghi rõ
      if (v.reason === "OTHER" && v.note === "")
        ctx.addIssue({ code: "custom", path: ["note"], message: "Ghi rõ lý do khi chọn “Khác”" });
      if (currentOwnerId && v.salesOwnerId === currentOwnerId)
        ctx.addIssue({
          code: "custom",
          path: ["salesOwnerId"],
          message: SALES_OWNER_LABELS.dialog.sameOwner,
        });
    });
}
