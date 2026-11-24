"use client";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { formatNumber, formatRatePercent } from "@/lib/format";
import { Card } from "@/components/shared/Card";

import { MONO } from "./copy";
import { MoneyCell } from "./primitives";

import type { EInvoice } from "../types";

const D = EINVOICE_LABELS.detail;
/** BE gửi thuế suất dạng phần trăm (8 = 8%, `EInvoiceLine.taxRate`), không phải phân số. */
const rate = (value: number | null | undefined) =>
  value == null ? "KCT" : formatRatePercent(value);

/**
 * Dòng hàng / dòng phí (docs 21 §4.1 bước 2); tổng theo thuế suất, tổng có thuế và số tiền bằng chữ.
 * Dòng âm là điều chỉnh giảm.
 *
 * Demo D-9: BE gửi dòng nguyên thùng theo đơn vị **thùng** (`EInvoiceDrafts`: `quantity` = số thùng,
 * `unit` = "Thùng", `unitPrice` = giá một thùng, `unitsPerCarton` = số cái / thùng); dòng lẻ cái thì
 * `unitsPerCarton` trống và `quantity` là số cái. Dòng phụ dưới tên chỉ quy đổi thùng ra cái — trước đây
 * lấy `quantity` chia `unitsPerCarton` như thể `quantity` là số cái, ra "0.003 thùng × 1000 Thùng".
 */
/** "3 thùng × 1.000 cái = 3.000 cái": `quantity` đã là số thùng (dấu âm của dòng giảm bỏ đi). */
function cartonHint(line: { quantity: number; unitsPerCarton?: number | null }) {
  const cartons = Math.abs(line.quantity);
  const perCarton = line.unitsPerCarton ?? 0;
  return `${formatNumber(cartons)} thùng × ${formatNumber(perCarton)} cái = ${formatNumber(cartons * perCarton)} cái`;
}

export function EInvoiceLinesCard({ invoice }: { invoice: EInvoice }) {
  const money = (amount: number) => <MoneyCell amount={amount} currency={invoice.currency} />;
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.lines}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Tên hàng</th>
              <th className="py-1 pr-2 text-right">SL</th>
              <th className="py-1 pr-2 text-right">Đơn giá</th>
              <th className="py-1 pr-2 text-right">Thuế suất</th>
              <th className="py-1 pr-2 text-right">Thành tiền</th>
              <th className="py-1 text-right">Tiền thuế</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className={`py-1.5 pr-2 ${MONO}`}>{line.lineNo}</td>
                <td className="py-1.5 pr-2">
                  <div>{line.itemName}</div>
                  {line.sku && (
                    <div className="text-ink-tertiary font-mono text-xs">{line.sku}</div>
                  )}
                  {line.unitsPerCarton ? (
                    <div className="text-ink-tertiary text-xs">{cartonHint(line)}</div>
                  ) : null}
                </td>
                <td className={`py-1.5 pr-2 text-right ${MONO}`}>
                  {formatNumber(line.quantity)} {line.unit}
                </td>
                <td className="py-1.5 pr-2 text-right">{money(line.unitPrice)}</td>
                <td className={`py-1.5 pr-2 text-right ${MONO}`}>{rate(line.taxRate)}</td>
                <td className="py-1.5 pr-2 text-right">{money(line.amount)}</td>
                <td className="py-1.5 text-right">{money(line.taxAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-border-default ml-auto max-w-sm space-y-1 border-t pt-3 text-[0.8125rem]">
        {invoice.totalsByRate.map((row) => (
          <div key={String(row.taxRate)} className="text-ink-secondary flex justify-between gap-4">
            <span>Thuế suất {rate(row.taxRate)}</span>
            <span>
              {money(row.amount)} · thuế {money(row.taxAmount)}
            </span>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <span>Cộng tiền hàng</span>
          {money(invoice.subtotal)}
        </div>
        <div className="flex justify-between gap-4">
          <span>Tiền thuế GTGT</span>
          {money(invoice.taxTotal)}
        </div>
        <div className="text-ink-primary flex justify-between gap-4 font-semibold">
          <span>Tổng có thuế</span>
          {money(invoice.grandTotal)}
        </div>
        {invoice.amountInWords && (
          <p className="text-ink-tertiary text-xs italic">Bằng chữ: {invoice.amountInWords}</p>
        )}
      </div>
    </Card>
  );
}
