/**
 * Báo giá B2B — hợp đồng BE local integration d215f6e (QuoteController, handoff SCRUM-448).
 * Jackson `non_null` → field null bị bỏ → response dùng `.nullish()`.
 */

import { z } from "zod";

import { PAYMENT_TERMS, QUOTE_API_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO ─────────────────────────────────────────────────────────────── */

const tierDtoSchema = z.object({ minQuantity: z.number().int(), unitPrice: z.number() });

export const quoteLineDtoSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  blankSku: z.string(),
  designSnapshotId: z.string(),
  printSpec: z.string().nullish(),
  quantity: z.number().int(),
  priced: z.boolean(),
  moq: z.number().int().nullish(),
  tiers: z.array(tierDtoSchema),
  proposedUnitPrice: z.number().nullish(),
  proposedLineTotal: z.number().nullish(),
  acceptedQuantity: z.number().int().nullish(),
  acceptedUnitPrice: z.number().nullish(),
  acceptedLineTotal: z.number().nullish(),
  /** Tính lại mỗi lần đọc: đã có mẫu được duyệt / là đơn lặp lại thiết kế cũ (BR-PRD-08, D4). */
  sample: z.object({
    satisfied: z.boolean(),
    approvedSampleId: z.string().nullish(),
    reorder: z.boolean(),
  }),
});

export const quoteTransitionDtoSchema = z.object({
  revision: z.number().int(),
  fromStatus: z.enum(QUOTE_API_STATUSES).nullish(),
  toStatus: z.enum(QUOTE_API_STATUSES),
  reason: z.string().nullish(),
  changedAt: z.string(),
  changedBy: z.string().nullish(),
});

export const quoteDtoSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  customerId: z.string(),
  status: z.enum(QUOTE_API_STATUSES),
  revision: z.number().int(),
  paymentTerm: z.enum(PAYMENT_TERMS),
  depositPercent: z.number().nullish(),
  validUntil: z.string(),
  terms: z.string().nullish(),
  lines: z.array(quoteLineDtoSchema),
  priced: z.boolean(),
  proposedTotal: z.number().nullish(),
  acceptedTotal: z.number().nullish(),
  sentAt: z.string().nullish(),
  respondedAt: z.string().nullish(),
  customerFeedback: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  convertedOrder: z
    .object({ orderId: z.string(), orderNumber: z.string(), status: z.string(), total: z.number() })
    .nullish(),
  convertedAt: z.string().nullish(),
  history: z.array(quoteTransitionDtoSchema),
  createdAt: z.string(),
  version: z.number().int(),
});

export const quoteRowDtoSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  customerId: z.string(),
  status: z.enum(QUOTE_API_STATUSES),
  revision: z.number().int(),
  paymentTerm: z.enum(PAYMENT_TERMS),
  validUntil: z.string(),
  sentAt: z.string().nullish(),
  convertedOrderId: z.string().nullish(),
  createdAt: z.string(),
  version: z.number().int(),
});
export const quotePageDtoSchema = bePageSchema(quoteRowDtoSchema);

/* ── Input (form) ────────────────────────────────────────────────────── */

const SKU = /^[A-Z0-9-]{3,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positiveInt = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .refine((v) => Number(v) >= 1, message);

export const tierInputSchema = z.object({
  minQuantity: positiveInt("Số lượng tối thiểu là số nguyên ≥ 1"),
  // Giá nguyên VND dương (BE `@Digits(15,0)`, ≥ 1) — không có trần chiết khấu, không cần duyệt
  // nội bộ (quyết định 2026-10-12); khách vẫn phải chấp nhận.
  unitPrice: positiveInt("Đơn giá là số nguyên VND ≥ 1").refine((v) => v.length <= 15, {
    message: "Đơn giá quá lớn",
  }),
});

export const quoteLineInputSchema = z
  .object({
    blankSku: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => SKU.test(v), "Mã phôi gồm 3–64 ký tự A–Z, 0–9, dấu -"),
    designSnapshotId: z.string().trim().regex(UUID, "Chọn thiết kế đã được khách xác nhận"),
    printSpec: z.string().trim().max(2000, "Tối đa 2000 ký tự"),
    // P6 (2026-10-12): đơn vị duy nhất là cái — không quy đổi thùng / carton.
    quantity: positiveInt("Số lượng (cái) là số nguyên ≥ 1").refine(
      (v) => Number(v) <= 10_000_000,
      "Tối đa 10.000.000 cái",
    ),
    /** true = để BE lấy bậc giá từ bảng giá khách (P7); false = Sales nhập bậc giá thoả thuận (P4). */
    useListPrice: z.boolean(),
    tiers: z.array(tierInputSchema).max(20, "Tối đa 20 bậc giá"),
  })
  .superRefine((line, ctx) => {
    if (!line.useListPrice && line.tiers.length === 0)
      ctx.addIssue({ code: "custom", path: ["tiers"], message: "Nhập ít nhất một bậc giá" });
    const mins = line.tiers.map((tier) => tier.minQuantity);
    if (new Set(mins).size !== mins.length)
      ctx.addIssue({
        code: "custom",
        path: ["tiers"],
        message: "Hai bậc giá trùng số lượng tối thiểu",
      });
  });

export const quoteFormSchema = z
  .object({
    customerId: z.string().regex(UUID, "Chọn khách hàng"),
    paymentTerm: z.enum(PAYMENT_TERMS),
    depositPercent: z.string().trim(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày hết hiệu lực"),
    terms: z.string().trim().max(2000, "Tối đa 2000 ký tự"),
    lines: z.array(quoteLineInputSchema).min(1, "Cần ít nhất một dòng").max(50, "Tối đa 50 dòng"),
  })
  .superRefine((form, ctx) => {
    if (form.paymentTerm === "DEPOSIT" && form.depositPercent !== "") {
      const value = Number(form.depositPercent);
      if (!(value > 0 && value < 100))
        ctx.addIssue({
          code: "custom",
          path: ["depositPercent"],
          message: "Tỷ lệ cọc trong khoảng (0, 100)",
        });
    }
    // BE: validUntil phải ở tương lai (kiểm lại khi gửi khách).
    if (form.validUntil && new Date(`${form.validUntil}T23:59:59+07:00`).getTime() <= Date.now())
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Hạn hiệu lực phải sau hôm nay",
      });
    // BE: một cặp phôi + thiết kế chỉ xuất hiện một lần.
    const seen = new Set<string>();
    form.lines.forEach((line, index) => {
      const key = `${line.blankSku.trim().toUpperCase()}|${line.designSnapshotId.trim()}`;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "designSnapshotId"],
          message: "Trùng thiết kế trên cùng phôi",
        });
      seen.add(key);
    });
  });

export const feedbackInputSchema = z.object({
  feedback: z
    .string()
    .trim()
    .min(1, "Ghi rõ nội dung cần chỉnh sửa")
    .max(2000, "Tối đa 2000 ký tự"),
});
