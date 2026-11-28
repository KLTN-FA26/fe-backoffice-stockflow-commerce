/**
 * Phân công khách — schema form gửi đi (api-conventions §3.1, lớp Input). Mỗi luật nghiệp vụ cite kế hoạch sales-owner
 * (`KE-HOACH.md`); BE kiểm lại tất cả và trả mã lỗi của hợp đồng.
 */

import { z } from "zod";

import { SALES_OWNER_LIMITS, TRANSFER_REASONS } from "@/constants/sales-owner";

const text = z.string().trim().max(SALES_OWNER_LIMITS.textMax, "Tối đa 1000 ký tự");
const DAY_MS = 86_400_000;

/** Số ngày của lịch, tính cả hai đầu (`yyyy-MM-dd`). */
export function coverDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** BR-S09 "Chuyển khách…": từ Sale A sang một hoặc nhiều Sale; tất cả hay một phần khách; lý do bắt buộc. */
export const transferInputSchema = z
  .object({
    fromUserId: z.string().min(1, "Chọn Sale đang phụ trách"),
    toUserIds: z.array(z.string()).min(1, "Chọn ít nhất một Sale nhận"),
    scope: z.enum(["all", "picked"]),
    customerIds: z.array(z.string()),
    reason: z.string().refine((v) => (TRANSFER_REASONS as readonly string[]).includes(v), {
      message: "Chọn lý do",
    }),
    note: text,
    temporary: z.boolean(),
    notifyCustomer: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // BR-S09: chuyển sang chính người đang phụ trách là không chuyển gì
    if (v.toUserIds.includes(v.fromUserId))
      ctx.addIssue({
        code: "custom",
        path: ["toUserIds"],
        message: "Sale nhận phải khác Sale đang phụ trách",
      });
    // BR-S09: "chọn tất cả hay một phần khách"
    if (v.scope === "picked" && v.customerIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["customerIds"], message: "Chọn ít nhất một khách" });
    // BR-S09: một lô tối đa 500 khách (BE SALES_OWNER_TRANSFER_TOO_LARGE)
    if (v.scope === "picked" && v.customerIds.length > SALES_OWNER_LIMITS.transferMax)
      ctx.addIssue({
        code: "custom",
        path: ["customerIds"],
        message: `Mỗi lần chuyển tối đa ${SALES_OWNER_LIMITS.transferMax} khách`,
      });
    // BR-S03: chọn "Khác" thì ghi rõ lý do
    if (v.reason === "OTHER" && v.note === "")
      ctx.addIssue({ code: "custom", path: ["note"], message: "Ghi rõ lý do khi chọn “Khác”" });
    // §10.1: lô "Tạm thời — chờ A quay lại" phải đánh dấu tạm để trả lại được trong một thao tác
    if (v.reason === "TEMPORARY_LEAVE" && !v.temporary)
      ctx.addIssue({
        code: "custom",
        path: ["temporary"],
        message: "Lý do “Tạm thời” cần đánh dấu lô tạm để trả lại sau",
      });
  });
export type TransferValues = z.infer<typeof transferInputSchema>;

/** D13 (giống "Pause assignment" / "Capacity" của Odoo): sức chứa trống = không giới hạn. */
export const assignmentSettingsInputSchema = z.object({
  paused: z.boolean(),
  capacityPerMonth: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), { message: "Nhập số nguyên từ 0" })
    .refine((v) => v === "" || Number(v) <= SALES_OWNER_LIMITS.capacityMax, {
      message: `Tối đa ${SALES_OWNER_LIMITS.capacityMax}`,
    }),
});
export type AssignmentSettingsValues = z.infer<typeof assignmentSettingsInputSchema>;

/** BR-S07 / D7: lịch người thay — không tự thay mình, từ ≤ đến, tối đa 60 ngày (chồng lịch BE kiểm). */
export const coverInputSchema = z
  .object({
    userId: z.string().min(1, "Chọn Sale vắng mặt"),
    coverUserId: z.string().min(1, "Chọn người thay"),
    from: z.string().min(1, "Chọn ngày bắt đầu"),
    to: z.string().min(1, "Chọn ngày kết thúc"),
    reason: text,
  })
  .superRefine((v, ctx) => {
    if (v.userId && v.coverUserId === v.userId)
      ctx.addIssue({
        code: "custom",
        path: ["coverUserId"],
        message: "Người thay phải là người khác",
      });
    if (!v.from || !v.to) return;
    if (v.to < v.from)
      ctx.addIssue({ code: "custom", path: ["to"], message: "Ngày kết thúc trước ngày bắt đầu" });
    else if (coverDays(v.from, v.to) > SALES_OWNER_LIMITS.coverMaxDays)
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Lịch thay tối đa ${SALES_OWNER_LIMITS.coverMaxDays} ngày`,
      });
  });
export type CoverValues = z.infer<typeof coverInputSchema>;

/** §10.4: quản lý giao lead cho một Sale. */
export const leadAssignInputSchema = z.object({
  salesUserId: z.string().min(1, "Chọn Sale nhận"),
});

/** §10.5 bước 3–4: quản lý đồng ý — chọn người phụ trách mới (điền sẵn người khách xin). */
export const approveRequestInputSchema = z.object({
  newSalesOwnerId: z.string().min(1, "Chọn Sale phụ trách mới"),
  note: text,
});
export type ApproveRequestValues = z.infer<typeof approveRequestInputSchema>;
