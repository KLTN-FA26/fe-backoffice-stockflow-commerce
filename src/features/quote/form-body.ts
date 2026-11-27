/**
 * Đổi qua lại giữa form báo giá và body `QuoteRequests.Create` / `Edit` của BE (origin/develop 438fe6fb).
 * Thuần — không gọi API.
 */

import { addDays, format, parseISO } from "date-fns";

import { QUOTE_DEFAULT_VALIDITY_DAYS } from "@/constants/numbers";

import { todayVn } from "./form-schemas";

import type { Quote, QuoteFormOutput, QuoteFormValues, QuoteLineFormValues } from "./types";

/** Ngày hết hiệu lực điền sẵn (`YYYY-MM-DD`, giờ VN). */
export function defaultValidUntil(today = todayVn()): string {
  return format(addDays(parseISO(today), QUOTE_DEFAULT_VALIDITY_DAYS), "yyyy-MM-dd");
}

/** Ngày hết hiệu lực (theo giờ VN) → Instant cuối ngày. */
export function endOfDayVn(day: string): string {
  return new Date(`${day}T23:59:59+07:00`).toISOString();
}

export function toQuoteBody(values: QuoteFormOutput) {
  const skus = new Set(values.lines.map((line) => line.sku.trim().toUpperCase()));
  const fees = [
    // 14 BR-17: phí khuôn do BE tự thêm; FE chỉ gửi lại số tiền (bỏ trống = chưa định giá).
    ...values.plateFees
      .filter((fee) => skus.has(fee.sku.toUpperCase()))
      .map((fee) => ({
        kind: "PLATE_FEE" as const,
        sku: fee.sku,
        ...(fee.amount ? { amount: Number(fee.amount) } : {}),
      })),
    // 14 BR-20: tối đa một dòng phí vận chuyển, có số tiền.
    ...(values.hasShippingFee
      ? [{ kind: "SHIPPING_FEE" as const, amount: Number(values.shippingFee) }]
      : []),
  ];
  return {
    validUntil: endOfDayVn(values.validUntil),
    ...(values.terms ? { terms: values.terms } : {}),
    ...(values.requestedDeliveryDate
      ? { requestedDeliveryDate: values.requestedDeliveryDate }
      : {}),
    lines: values.lines.map((line) => ({
      sku: line.sku.trim().toUpperCase(),
      cartons: Number(line.cartons),
      // Bỏ `tiers` = BE lấy giá riêng của khách cho SKU (13 BR-05).
      ...(line.tiers.length
        ? {
            tiers: line.tiers.map((tier) => ({
              minQuantity: Number(tier.minQuantity),
              unitPrice: Number(tier.unitPrice),
            })),
          }
        : {}),
    })),
    fees,
  };
}

export const EMPTY_LINE: QuoteLineFormValues = {
  sku: "",
  cartons: "",
  hasCustomerPrice: false,
  tiers: [],
};

export function emptyQuoteForm(customerId = ""): QuoteFormValues {
  return {
    customerId,
    validUntil: defaultValidUntil(),
    requestedDeliveryDate: "",
    terms: "",
    lines: [EMPTY_LINE],
    plateFees: [],
    shippingFee: "",
    hasShippingFee: false,
  };
}

/** Báo giá nháp → giá trị form. Bậc giá đã chụp trên báo giá giữ nguyên khi sửa. */
export function toQuoteFormValues(quote: Quote): QuoteFormValues {
  const shipping = quote.fees.find((fee) => fee.kind === "SHIPPING_FEE");
  return {
    customerId: quote.customerId,
    validUntil: new Date(quote.validUntil).toLocaleDateString("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
    }),
    requestedDeliveryDate: quote.requestedDeliveryDate ?? "",
    terms: quote.terms ?? "",
    lines: quote.lines.map((line) => ({
      sku: line.sku,
      cartons: line.cartons != null ? String(line.cartons) : "",
      // Báo giá đã lưu luôn có bậc giá chụp lại; cờ chỉ có nghĩa khi Sale xoá hết bậc giá.
      hasCustomerPrice: false,
      tiers: line.tiers.map((tier) => ({
        minQuantity: String(tier.minQuantity),
        unitPrice: String(tier.unitPrice),
      })),
    })),
    plateFees: quote.fees
      .filter((fee) => fee.kind === "PLATE_FEE" && fee.sku)
      .map((fee) => ({ sku: fee.sku ?? "", amount: fee.amount != null ? String(fee.amount) : "" })),
    shippingFee: shipping?.amount != null ? String(shipping.amount) : "",
    hasShippingFee: !!shipping,
  };
}
