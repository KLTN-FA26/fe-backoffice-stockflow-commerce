/**
 * Danh mục đơn vị sản xuất (kltn-docs 17 §4.3; BE `ProducerController`) — DTO parse tại biên API và schema form.
 * BE `default-property-inclusion: non_null`: trường null vắng mặt → `.nullish()`.
 */

import { z } from "zod";

import {
  PRODUCER_CHANNELS,
  PRODUCER_STATUSES,
  PRODUCTION_LABELS,
  PRODUCTION_LIMITS as LIMITS,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const V = PRODUCTION_LABELS.producer.validation;

// ---- DTO -----------------------------------------------------------------------------------------------------------

/** BE `ProducerResponse`. */
export const producerDto = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  email: z.string().nullish(),
  channel: z.enum(PRODUCER_CHANNELS),
  /** Thời gian sản xuất chuẩn (ngày) — dùng cho cảnh báo PO_NEEDED (BR-30). */
  standardLeadDays: z.number().int(),
  status: z.enum(PRODUCER_STATUSES),
  note: z.string().nullish(),
  version: z.number().int(),
});

export const producerPageDto = bePageSchema(producerDto);

// ---- Input ---------------------------------------------------------------------------------------------------------

/** BE `ProducerRequest.code` — "2-32 letters, digits, '-' or '_'"; BE viết hoa. */
const CODE = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9_-]{${LIMITS.producerCodeMin - 1},${LIMITS.producerCodeMax - 1}}$`,
);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEGER = /^\d+$/;

/**
 * Form thêm / sửa đơn vị sản xuất — chuỗi thô của ô nhập, kiểm theo `@Size` / `@Min` / `@Max` của `ProducerRequest`.
 * Mã chỉ kiểm khi tạo (`editing` = false): BE bỏ qua mã khi sửa.
 */
export function producerFormSchema(editing: boolean) {
  return z
    .object({
      code: z.string().trim(),
      name: z.string().trim().min(1, V.nameRequired).max(LIMITS.producerNameMax, V.nameMax),
      channel: z.enum(PRODUCER_CHANNELS),
      email: z.string().trim().max(LIMITS.emailMax, V.emailMax),
      contactName: z.string().trim().max(LIMITS.contactNameMax, V.contactNameMax),
      contactPhone: z.string().trim().max(LIMITS.contactPhoneMax, V.contactPhoneMax),
      standardLeadDays: z
        .string()
        .trim()
        // B44: bỏ trống = 14 ngày (BE mặc định); có nhập thì 1–365
        .refine((raw) => {
          if (raw === "") return true;
          if (!INTEGER.test(raw)) return false;
          const days = Number(raw);
          return days >= LIMITS.leadDaysMin && days <= LIMITS.leadDaysMax;
        }, V.leadDaysRange),
      note: z.string().trim().max(LIMITS.textMax, V.noteMax),
      status: z.enum(PRODUCER_STATUSES),
    })
    .superRefine((value, ctx) => {
      if (!editing) {
        if (value.code === "")
          ctx.addIssue({ code: "custom", path: ["code"], message: V.codeRequired });
        else if (!CODE.test(value.code))
          ctx.addIssue({ code: "custom", path: ["code"], message: V.codeFormat });
      }
      // Docs 17 §4.3: kênh Email cần địa chỉ nhận đơn (BE `Producer` — email bắt buộc khi channel = EMAIL)
      if (value.channel === "EMAIL" && value.email === "")
        ctx.addIssue({ code: "custom", path: ["email"], message: V.emailRequired });
      if (value.email !== "" && !EMAIL.test(value.email))
        ctx.addIssue({ code: "custom", path: ["email"], message: V.emailFormat });
    });
}
