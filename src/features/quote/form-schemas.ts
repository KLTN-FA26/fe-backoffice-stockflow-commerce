/**
 * Báo giá — schema của form lập / sửa (BE `QuoteRequests.Create` / `Edit`, origin/develop 438fe6fb).
 * Giá trị form là chuỗi (ô nhập); `api.ts` đổi sang số khi gửi.
 */

import { z } from "zod";

/* ── Input (form) ────────────────────────────────────────────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INT = /^\d+$/;

/** Hôm nay theo giờ Việt Nam, `YYYY-MM-DD` (BE `BusinessCalendar`). */
export function todayVn(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

const positiveInt = (message: string) =>
  z
    .string()
    .trim()
    .regex(INT, message)
    .refine((v) => Number(v) >= 1, message);

export const tierInputSchema = z.object({
  // BE `QuoteRequests.Tier`: minQuantity ≥ 1 (thùng), unitPrice nguyên VND ≥ 1 (`@Digits(15,0)`).
  minQuantity: positiveInt("Số thùng tối thiểu là số nguyên ≥ 1"),
  unitPrice: positiveInt("Đơn giá là số nguyên VND ≥ 1").refine((v) => v.length <= 15, {
    message: "Đơn giá quá lớn",
  }),
});

export const quoteLineInputSchema = z
  .object({
    /** SKU riêng của khách (14 BR-04): chỉ chọn từ danh sách, không gõ tự do. */
    sku: z.string().trim().min(1, "Chọn SKU riêng của khách"),
    cartons: positiveInt("Số thùng là số nguyên ≥ 1").refine(
      (v) => Number(v) <= 1_000_000,
      "Tối đa 1.000.000 thùng",
    ),
    /** Do form điền theo `GET /catalog/customer-prices/{customerId}/{sku}` (200 = có giá riêng). */
    hasCustomerPrice: z.boolean(),
    tiers: z.array(z.object({ minQuantity: z.string().trim(), unitPrice: z.string().trim() })),
  })
  .superRefine((line, ctx) => {
    // 13 BR-05: bỏ trống bậc giá = BE lấy giá riêng của khách; không có giá riêng thì phải nhập.
    if (line.tiers.length === 0) {
      if (!line.hasCustomerPrice)
        ctx.addIssue({
          code: "custom",
          path: ["tiers"],
          message: "Khách chưa có giá riêng cho SKU này — nhập ít nhất một bậc giá",
        });
      return;
    }
    if (line.tiers.length > 20)
      ctx.addIssue({ code: "custom", path: ["tiers"], message: "Tối đa 20 bậc giá" });
    line.tiers.forEach((tier, index) => {
      for (const issue of tierInputSchema.safeParse(tier).error?.issues ?? [])
        ctx.addIssue({
          code: "custom",
          path: ["tiers", index, ...issue.path],
          message: issue.message,
        });
    });
    const mins = line.tiers.map((tier) => tier.minQuantity);
    if (new Set(mins).size !== mins.length)
      ctx.addIssue({
        code: "custom",
        path: ["tiers"],
        message: "Hai bậc giá trùng số thùng tối thiểu",
      });
  });

export const quoteFormSchema = z
  .object({
    customerId: z.string().regex(UUID, "Chọn khách hàng"),
    validUntil: z.string().regex(DAY, "Chọn ngày hết hiệu lực"),
    requestedDeliveryDate: z.string().trim(),
    terms: z.string().trim().max(2000, "Tối đa 2.000 ký tự"),
    lines: z.array(quoteLineInputSchema).min(1, "Cần ít nhất một dòng").max(50, "Tối đa 50 dòng"),
    /** Phí khuôn BE tự thêm cho SKU sản xuất lần đầu (14 BR-17); để trống được khi lưu nháp. */
    plateFees: z.array(z.object({ sku: z.string(), amount: z.string().trim() })),
    /** Phí vận chuyển: tối đa một dòng, số tiền > 0 (14 BR-20). "" = không thu. */
    shippingFee: z.string().trim(),
    hasShippingFee: z.boolean(),
  })
  .superRefine((form, ctx) => {
    // BE: validUntil phải ở tương lai.
    if (form.validUntil && form.validUntil <= todayVn())
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Hạn hiệu lực phải sau hôm nay",
      });
    // BE `refusal.quote.requestedDatePast`: ngày giao khách yêu cầu không ở quá khứ (hôm nay được).
    if (form.requestedDeliveryDate) {
      if (!DAY.test(form.requestedDeliveryDate))
        ctx.addIssue({
          code: "custom",
          path: ["requestedDeliveryDate"],
          message: "Ngày không hợp lệ",
        });
      else if (form.requestedDeliveryDate < todayVn())
        ctx.addIssue({
          code: "custom",
          path: ["requestedDeliveryDate"],
          message: "Ngày giao không được ở quá khứ",
        });
    }
    // BE: mỗi SKU chỉ một dòng.
    const seen = new Set<string>();
    form.lines.forEach((line, index) => {
      const sku = line.sku.trim().toUpperCase();
      if (sku && seen.has(sku))
        ctx.addIssue({
          code: "custom",
          path: ["lines", index, "sku"],
          message: "SKU đã có ở dòng khác",
        });
      seen.add(sku);
    });
    form.plateFees.forEach((fee, index) => {
      if (fee.amount && !INT.test(fee.amount))
        ctx.addIssue({
          code: "custom",
          path: ["plateFees", index, "amount"],
          message: "Số tiền nguyên VND, ≥ 0",
        });
    });
    if (form.hasShippingFee && (!INT.test(form.shippingFee) || Number(form.shippingFee) <= 0))
      ctx.addIssue({
        code: "custom",
        path: ["shippingFee"],
        message: "Phí vận chuyển là số nguyên VND > 0",
      });
  });

export const cancelReasonSchema = z
  .string()
  .trim()
  .min(1, "Ghi lý do huỷ")
  .max(500, "Tối đa 500 ký tự");
