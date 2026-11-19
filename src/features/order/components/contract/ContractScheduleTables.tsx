"use client";

import { CONTRACT_MILESTONE_LABELS, CONTRACT_MILESTONES } from "@/constants";
import { formatDate } from "@/lib/format/date";

import type { SalesContract } from "../../sales-contract-schemas";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
const TH = "px-2 py-1.5 text-left font-medium";
const TD = "px-2 py-1.5 align-top";

function milestoneLabel(value: string): string {
  return (CONTRACT_MILESTONES as readonly string[]).includes(value)
    ? CONTRACT_MILESTONE_LABELS[value as (typeof CONTRACT_MILESTONES)[number]]
    : value;
}

/** Lịch giao (đợt, cửa sổ, SKU × thùng = cái, giá trị đợt) và lịch thanh toán của hợp đồng — số của BE. */
export function ContractScheduleTables({
  contract,
  money,
}: {
  contract: SalesContract;
  money: (amount: number) => string;
}) {
  return (
    <>
      <table className="w-full text-[0.8125rem]">
        <caption className="text-ink-secondary mb-1 text-left text-xs font-medium">
          Lịch giao
        </caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th className={TH}>Đợt</th>
            <th className={TH}>Cửa sổ giao</th>
            <th className={TH}>Dòng (SKU × thùng = cái)</th>
            <th className={`${TH} text-right`}>Giá trị đợt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {contract.deliverySchedule.map((batch) => (
            <tr key={batch.seq}>
              <td className={`${TD} ${MONO}`}>{batch.seq}</td>
              <td className={TD}>
                {batch.windowStart
                  ? `${formatDate(batch.windowStart)} – ${formatDate(batch.windowEnd ?? batch.windowStart)}`
                  : "—"}
              </td>
              <td className={TD}>
                {batch.lines.map((line) => (
                  <div key={line.orderLineId} className={MONO}>
                    {line.sku ?? line.orderLineId} × {line.cartons} ={" "}
                    {line.units.toLocaleString("vi-VN")} cái
                  </div>
                ))}
              </td>
              <td className={`${TD} text-right ${MONO}`}>{money(batch.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-[0.8125rem]">
        <caption className="text-ink-secondary mb-1 text-left text-xs font-medium">
          Lịch thanh toán
        </caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th className={TH}>Đợt</th>
            <th className={TH}>Tên</th>
            <th className={TH}>Mốc</th>
            <th className={`${TH} text-right`}>%</th>
            <th className={`${TH} text-right`}>Số tiền</th>
            <th className={`${TH} text-right`}>Số ngày</th>
            <th className={`${TH} text-right`}>Đợt giao</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {contract.paymentPlan.map((entry) => (
            <tr key={entry.seq}>
              <td className={`${TD} ${MONO}`}>{entry.seq}</td>
              <td className={TD}>{entry.name}</td>
              <td className={TD}>{milestoneLabel(entry.milestone)}</td>
              <td className={`${TD} text-right ${MONO}`}>
                {entry.percent != null ? `${entry.percent}%` : "—"}
              </td>
              <td className={`${TD} text-right ${MONO}`}>{money(entry.amount)}</td>
              <td className={`${TD} text-right ${MONO}`}>{entry.dueDays ?? "—"}</td>
              <td className={`${TD} text-right ${MONO}`}>{entry.deliveryBatchSeq ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
