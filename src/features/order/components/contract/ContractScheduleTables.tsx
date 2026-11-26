"use client";

import {
  CONTRACT_MILESTONE_LABELS,
  CONTRACT_MILESTONES,
  ORDER_INSTALLMENTS_LABELS,
} from "@/constants";
import { formatDate, toLocalIsoDate } from "@/lib/format/date";

import { dueRuleText } from "../../sales-contract-rules";
import { installmentDue } from "../../selectors";

import type { OrderInstallmentsSummary } from "../../installments-summary-api";
import type { SalesContract } from "../../sales-contract-schemas";

export type ContractInstallmentFigures = OrderInstallmentsSummary["installments"][number];

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
const TH = "px-2 py-1.5 text-left font-medium";
const TD = "px-2 py-1.5 align-top";

function milestoneLabel(value: string): string {
  return (CONTRACT_MILESTONES as readonly string[]).includes(value)
    ? CONTRACT_MILESTONE_LABELS[value as (typeof CONTRACT_MILESTONES)[number]]
    : value;
}

/**
 * Lịch giao (đợt, cửa sổ, SKU × thùng = cái, giá trị đợt) và lịch thanh toán của hợp đồng — số của BE. Lịch thanh toán
 * ghi hạn trả thật khi đã có (hợp đồng đã ký), còn không thì quy tắc ra hạn ("Hạn = ngày ký + 3 ngày").
 */
export function ContractScheduleTables({
  contract,
  money,
  installments,
}: {
  contract: SalesContract;
  money: (amount: number) => string;
  /** Các đợt thật của hợp đồng đã ký (khi người xem đọc được), để hiện đã thu / còn theo từng đợt. */
  installments?: readonly ContractInstallmentFigures[];
}) {
  const bySeq = new Map((installments ?? []).map((installment) => [installment.seq, installment]));
  const paid = bySeq.size > 0;
  const today = toLocalIsoDate(new Date().toISOString());
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
                  <div key={line.orderLineId}>
                    <span className={MONO}>
                      {line.sku ?? "—"} × {line.cartons} = {line.units.toLocaleString("vi-VN")} cái
                    </span>
                    {line.designName && (
                      <span className="text-ink-secondary block text-xs">{line.designName}</span>
                    )}
                  </div>
                ))}
              </td>
              <td className={`${TD} text-right ${MONO}`}>{money(batch.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Cùng chú thích như storefront: giá trị đợt khác tổng đơn vì chỉ tính hàng (UX audit S06-7) */}
      <p className="text-ink-tertiary -mt-1 text-xs">
        Giá trị đợt là giá trị hàng của đợt (gồm VAT, chưa gồm phí).
      </p>
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
            <th className={TH}>Hạn trả</th>
            {paid && <th className={`${TH} text-right`}>Đã thu / Còn</th>}
            <th className={`${TH} text-right`}>Đợt giao</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--table-line)]">
          {contract.paymentPlan.map((entry) => {
            const installment = bySeq.get(entry.seq);
            // BO-UX-28: đã ký → ngày đến hạn thật (của đợt, hoặc R5-12 trên hợp đồng); chưa ký → quy tắc ra hạn.
            // The order's installment wins, but a field it leaves out keeps the contract's own value.
            const due = installmentDue(
              {
                ...installment,
                dueDate: installment?.dueDate ?? entry.dueDate,
                daysOverdue: installment?.daysOverdue ?? entry.daysOverdue,
              },
              today,
            );
            return (
              <tr key={entry.seq}>
                <td className={`${TD} ${MONO}`}>{entry.seq}</td>
                <td className={TD}>{entry.name}</td>
                <td className={TD}>{milestoneLabel(entry.milestone)}</td>
                <td className={`${TD} text-right ${MONO}`}>
                  {entry.percent != null ? `${entry.percent}%` : "—"}
                </td>
                <td className={`${TD} text-right ${MONO}`}>{money(entry.amount)}</td>
                <td className={TD}>
                  {due.dueDate ? (
                    <span className={MONO}>{formatDate(due.dueDate)}</span>
                  ) : (
                    <span className="text-ink-secondary">{dueRuleText(entry)}</span>
                  )}
                  {due.daysOverdue > 0 && (
                    <span className="text-danger block text-xs font-medium">
                      {ORDER_INSTALLMENTS_LABELS.overdueDays(due.daysOverdue)}
                    </span>
                  )}
                </td>
                {paid && (
                  <td className={`${TD} text-right ${MONO}`}>
                    {installment ? (
                      <>
                        {money(installment.paidAmount)}
                        <span className="text-ink-secondary block text-xs">
                          còn{" "}
                          {money(
                            installment.outstanding ??
                              Math.max(0, installment.amount - installment.paidAmount),
                          )}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={`${TD} text-right ${MONO}`}>{entry.deliveryBatchSeq ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
