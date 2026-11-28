"use client";

import { useWatch } from "react-hook-form";

import { formatMoney } from "@/lib/format/money";
import { lineAmount, previewTotals, tierPrice } from "@/features/quote/selectors";
import { Card } from "@/components/shared/Card";

import type { UseFormReturn } from "react-hook-form";
import type { PreviewItem, PriceReferences } from "@/features/quote/selectors";
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
 * Giá tham chiếu từng dòng do khung tóm tắt đọc một lần (`usePriceReferences`) và truyền vào.
 */
export function QuoteTotalsPreview({
  form,
  quote,
  customerSkus = [],
  references,
}: {
  form: UseFormReturn<QuoteFormValues>;
  quote?: Quote;
  /** SKU riêng của khách: `unitsPerCarton` / `taxRate` (R5-4, khi BE trả) cho dòng chưa lưu (BO-UX-16). */
  customerSkus?: readonly CustomerSku[];
  /** Giá tham chiếu của từng dòng, cùng thứ tự với `lines`. */
  references: readonly PriceReferences[];
}) {
  const [lines, plateFees, hasShippingFee, shippingFee] = useWatch({
    control: form.control,
    name: ["lines", "plateFees", "hasShippingFee", "shippingFee"],
  });
  const skus = (lines ?? []).map((line) => line.sku?.trim().toUpperCase() ?? "");
  const bySku = new Map(customerSkus.map((sku) => [sku.sku.trim().toUpperCase(), sku]));

  const saved = new Map(quote?.lines.map((line) => [line.sku, line]) ?? []);
  const items: (PreviewItem | null)[] = (lines ?? []).map((line, index) => {
    const known = saved.get(skus[index] ?? "");
    const own = toTiers(line.tiers);
    const reference = references[index]?.own ?? references[index]?.standard ?? [];
    const tiers = own.length ? own : reference;
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
