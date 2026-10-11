/**
 * Order — schema FORM của các dialog thao tác (react-hook-form + zodResolver, api-conventions §4).
 *
 * Ô nhập luôn là chuỗi (Select chưa chọn = "", ô số rỗng = ""). Schema form chuẩn hoá chuỗi rồi
 * parse bằng Input schema của `action-schemas.ts` — BR + giới hạn BE chỉ khai báo MỘT chỗ ở đó.
 */

import { z } from "zod";

import {
  adminCancelOrderSchema,
  creditApprovalSchema,
  creditRejectionSchema,
  releaseOrderSchema,
} from "./action-schemas";

/**
 * Parse giá trị đã chuẩn hoá bằng Input schema đích; lỗi giữ nguyên `path` + message để RHF gắn
 * đúng ô. (`.pipe()` đòi kiểu đầu vào trùng khớp — chuỗi tự do không khớp enum đích.)
 */
function parseInto<T extends z.ZodType>(target: T) {
  return (value: unknown, ctx: z.RefinementCtx): z.output<T> => {
    const result = target.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
    return z.NEVER;
  };
}

/** "" → undefined; còn lại → số (NaN nếu nhập sai → schema đích báo lỗi kiểu). */
function optionalNumber(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw);
}

export const releaseFormSchema = releaseOrderSchema;
export const RELEASE_FORM_DEFAULTS: z.input<typeof releaseFormSchema> = { warehouseId: "" };

export const creditApprovalFormSchema = creditApprovalSchema;
export const CREDIT_APPROVAL_FORM_DEFAULTS: z.input<typeof creditApprovalFormSchema> = { note: "" };

export const creditRejectionFormSchema = z
  .object({ action: z.string(), depositPercent: z.string(), note: z.string() })
  .transform((v) => ({
    action: v.action || undefined,
    // Bỏ trống → BE dùng % cọc mặc định của hồ sơ công nợ khách
    depositPercent: optionalNumber(v.depositPercent),
    note: v.note,
  }))
  .transform(parseInto(creditRejectionSchema));
export const CREDIT_REJECTION_FORM_DEFAULTS: z.input<typeof creditRejectionFormSchema> = {
  action: "",
  depositPercent: "",
  note: "",
};

export const adminCancelFormSchema = z
  .object({ reasonCode: z.string(), note: z.string(), retainedPercent: z.string() })
  .transform((v) => ({
    reasonCode: v.reasonCode || undefined,
    note: v.note.trim() || undefined,
    retainedPercent: optionalNumber(v.retainedPercent),
  }))
  .transform(parseInto(adminCancelOrderSchema));
export const ADMIN_CANCEL_FORM_DEFAULTS: z.input<typeof adminCancelFormSchema> = {
  reasonCode: "",
  note: "",
  retainedPercent: "",
};

export type ReleaseFormValues = z.input<typeof releaseFormSchema>;
export type CreditApprovalFormValues = z.input<typeof creditApprovalFormSchema>;
export type CreditRejectionFormValues = z.input<typeof creditRejectionFormSchema>;
export type AdminCancelFormValues = z.input<typeof adminCancelFormSchema>;
