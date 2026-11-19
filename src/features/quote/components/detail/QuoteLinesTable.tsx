"use client";

import { formatMoney } from "@/lib/format/money";

import { MONO } from "../copy";

import type { QuoteLine } from "@/features/quote/types";

/** Số hiển thị của dòng: đã chấp nhận → số chốt; còn lại → số đề xuất (đều do BE tính). */
export function lineFigures(line: QuoteLine) {
  const accepted = line.acceptedCartons != null;
  return {
    cartons: accepted ? line.acceptedCartons : line.cartons,
    units: accepted ? (line.acceptedUnits ?? line.units) : line.units,
    unitPrice: accepted ? line.acceptedUnitPrice : line.proposedUnitPrice,
    total: accepted ? line.acceptedLineTotal : line.proposedLineTotal,
    tax: accepted ? line.acceptedTax : line.proposedTax,
  };
}

const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-2 align-top";
const NUM = `${TD} text-right ${MONO}`;
const HEADERS: [string, boolean][] = [
  ["#", false],
  ["SKU", false],
  ["Thùng", true],
  ["Cái", true],
  ["MOQ (thùng)", true],
  ["Bậc giá (từ thùng → đ/cái)", false],
  ["Đơn giá", true],
  ["Thành tiền", true],
  ["Thuế suất", true],
  ["Tiền thuế", true],
];

/** Bảng dòng báo giá theo thùng — số liệu đọc nguyên từ BE, FE không tự tính giá. */
export function QuoteLinesTable({ lines }: { lines: QuoteLine[] }) {
  return (
    <div
      role="region"
      aria-label="Các dòng của báo giá"
      tabIndex={0}
      className="border-border-default bg-bg-surface focus-visible:ring-brand overflow-x-auto rounded-[var(--card-radius)] border shadow-[var(--card-shadow)] focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="w-full min-w-[960px] text-[0.8125rem]">
        <caption className="sr-only">Các dòng của báo giá</caption>
        <thead className="bg-bg-subtle text-ink-secondary text-left">
          <tr>
            {HEADERS.map(([label, right]) => (
              <th key={label} scope="col" className={`${TH} ${right ? "text-right" : ""}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {lines.map((line) => {
            const figures = lineFigures(line);
            return (
              <tr key={line.id}>
                <td className={`${TD} ${MONO}`}>{line.lineNo}</td>
                <td className={`${TD} ${MONO}`}>{line.sku}</td>
                <td className={NUM}>{figures.cartons ?? "—"}</td>
                <td className={NUM}>{figures.units.toLocaleString("vi-VN")}</td>
                <td className={NUM}>{line.moq ?? "—"}</td>
                <td className={TD}>
                  {line.tiers.length === 0 ? (
                    <span className="text-ink-tertiary">Chưa có giá</span>
                  ) : (
                    <ul className={MONO}>
                      {line.tiers.map((tier) => (
                        <li key={tier.minQuantity}>
                          ≥ {tier.minQuantity} → {formatMoney(tier.unitPrice, "VND")}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={NUM}>
                  {figures.unitPrice != null ? formatMoney(figures.unitPrice, "VND") : "—"}
                </td>
                <td className={`${NUM} text-ink-primary font-semibold`}>
                  {figures.total != null ? formatMoney(figures.total, "VND") : "—"}
                </td>
                <td className={NUM}>{line.taxRate != null ? `${line.taxRate}%` : "—"}</td>
                <td className={NUM}>
                  {figures.tax != null ? formatMoney(figures.tax, "VND") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
