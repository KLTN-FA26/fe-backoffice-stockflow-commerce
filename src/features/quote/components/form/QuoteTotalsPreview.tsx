"use client";

import { useQueries } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";

import { Card } from "@/components/shared/Card";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { formatMoney } from "@/lib/format/money";
import { getCustomerPrice, getStandardPriceSuggestion } from "@/features/quote/api";
import { customerSkuKeys } from "@/features/quote/queries";
import { lineAmount, previewTotals, tierPrice } from "@/features/quote/selectors";

import type { UseFormReturn } from "react-hook-form";
import type { PreviewItem } from "@/features/quote/selectors";
import type { CustomerSku, Quote, QuoteFormValues, QuoteTier } from "@/features/quote/types";

const NUM = "tabular-nums font-[family-name:var(--font-mono)]";

function toTiers(values: QuoteFormValues["lines"][number]["tiers"] | undefined): QuoteTier[] {
  return (values ?? [])
    .map((tier) => ({ minQuantity: Number(tier.minQuantity), unitPrice: Number(tier.unitPrice) }))
    .filter((tier) => tier.minQuantity > 0 && tier.unitPrice > 0);
}

/**
 * Tổng xem trước của báo giá đang sửa (kế hoạch WF-02 A3): tiền hàng = Σ thùng × cái/thùng × đơn giá theo bậc (bậc Sale
 * nhập, không có thì giá riêng của khách, không có nữa thì giá chuẩn của quy cách), phí đã nhập, thuế từng khoản theo thuế suất BE đã điền lần lưu trước, tổng
 * có thuế. Không đoán: một dòng chưa tính được (thiếu giá, dưới MOQ, chưa biết cái/thùng) thì chưa có tiền hàng; một
 * khoản chưa biết thuế suất (dòng / phí mới, chưa lưu) thì thuế và tổng có thuế "tính khi lưu". Số chính thức là của BE.
 */
export function QuoteTotalsPreview({
  form,
  customerId,
  quote,
  customerSkus = [],
}: {
  form: UseFormReturn<QuoteFormValues>;
  customerId: string;
  quote?: Quote;
  /** SKU riêng của khách: `unitsPerCarton` / `taxRate` (R5-4, khi BE trả) cho dòng chưa lưu (BO-UX-16). */
  customerSkus?: readonly CustomerSku[];
}) {
  const [lines, plateFees, hasShippingFee, shippingFee] = useWatch({
    control: form.control,
    name: ["lines", "plateFees", "hasShippingFee", "shippingFee"],
  });
  const skus = (lines ?? []).map((line) => line.sku?.trim().toUpperCase() ?? "");
  // Cùng khoá với `useCustomerPrice` của từng dòng: đọc lại cache, không gọi thêm.
  const prices = useQueries({
    queries: skus.map((sku) => ({
      queryKey: customerSkuKeys.price(customerId, sku),
      queryFn: ({ signal }: { signal: AbortSignal }) => getCustomerPrice(customerId, sku, signal),
      enabled: !!customerId && !!sku,
      ...QUERY_TIMES.master,
    })),
  });

  const bySku = new Map(customerSkus.map((sku) => [sku.sku.trim().toUpperCase(), sku]));
  // Giá chuẩn của quy cách (13 BR-04 sửa ngày 2026-11-26): chỉ ĐỌC cache mà từng dòng đã tải (dòng mới hỏi khi khách
  // không có giá riêng và người dùng được xem giá chuẩn) — không gọi thêm ở đây.
  const standards = useQueries({
    queries: skus.map((sku) => {
      const variantSku = bySku.get(sku)?.sourceSku?.trim().toUpperCase() ?? "";
      return {
        queryKey: customerSkuKeys.standardPrice(variantSku),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getStandardPriceSuggestion(variantSku, signal),
        enabled: false,
        ...QUERY_TIMES.master,
      };
    }),
  });

  const saved = new Map(quote?.lines.map((line) => [line.sku, line]) ?? []);
  const items: (PreviewItem | null)[] = (lines ?? []).map((line, index) => {
    const known = saved.get(skus[index] ?? "");
    const own = toTiers(line.tiers);
    const reference = prices[index]?.data ?? standards[index]?.data ?? null;
    const tiers = own.length ? own : (reference?.tiers ?? []);
    const cartons = Number(line.cartons);
    const unitPrice = tierPrice(tiers, cartons);
    const customerSku = bySku.get(skus[index] ?? "");
    const perCarton = known?.unitsPerCarton ?? customerSku?.unitsPerCarton ?? null;
    if (unitPrice === null || !perCarton) return null;
    return {
      amount: lineAmount(cartons, perCarton, unitPrice),
      taxRate: known?.taxRate ?? customerSku?.taxRate ?? null,
    };
  });

  const feeRate = (kind: "PLATE_FEE" | "SHIPPING_FEE", sku?: string) =>
    quote?.fees.find((fee) => fee.kind === kind && (sku === undefined || fee.sku === sku))
      ?.taxRate ?? null;
  const fees: PreviewItem[] = [
    ...(plateFees ?? [])
      .filter((fee) => Number(fee.amount) > 0)
      .map((fee) => ({ amount: Number(fee.amount), taxRate: feeRate("PLATE_FEE", fee.sku) })),
    ...(hasShippingFee && Number(shippingFee) > 0
      ? [{ amount: Number(shippingFee), taxRate: feeRate("SHIPPING_FEE") }]
      : []),
  ];

  const priced = items.length > 0 && items.every((item) => item !== null);
  const known = items.filter((item): item is PreviewItem => item !== null);
  const totals = previewTotals(known, fees);
  const taxKnown = priced && [...known, ...fees].every((item) => item.taxRate != null);
  const money = (value: number) => formatMoney(value, "VND");

  return (
    <Card className="space-y-2" aria-live="polite">
      <h2 className="text-ink-primary text-sm font-semibold">Tạm tính báo giá</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[0.8125rem]">
        <dt className="text-ink-secondary">Tiền hàng</dt>
        <dd className={priced ? `text-right ${NUM}` : "text-ink-tertiary text-right"}>
          {priced ? money(totals.subtotal) : "chưa đủ giá"}
        </dd>
        <dt className="text-ink-secondary">Phí</dt>
        <dd className={`text-right ${NUM}`}>{money(totals.fees)}</dd>
        <dt className="text-ink-secondary">Thuế</dt>
        <dd className={taxKnown ? `text-right ${NUM}` : "text-ink-tertiary text-right"}>
          {taxKnown ? money(totals.tax) : "tính khi lưu"}
        </dd>
        <dt className="text-ink-primary font-semibold">Tổng có thuế</dt>
        <dd
          className={
            taxKnown
              ? `text-ink-primary text-right font-semibold ${NUM}`
              : "text-ink-tertiary text-right font-semibold"
          }
        >
          {taxKnown ? money(totals.total) : "—"}
        </dd>
      </dl>
      <p className="text-ink-tertiary text-xs">
        Thuế theo thuế suất hệ thống điền khi lưu; dòng hoặc phí mới có thuế sau khi lưu nháp.
      </p>
    </Card>
  );
}
