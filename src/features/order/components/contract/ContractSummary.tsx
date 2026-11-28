"use client";

import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { DEFAULT_RETURN_WINDOW_DAYS } from "../../sales-contract-form";

import { ContractTermsSummary } from "./ContractTermsSummary";

import { ContractScheduleTables } from "./ContractScheduleTables";

import type { ReactNode } from "react";
import type { ContractInstallmentFigures } from "./ContractScheduleTables";
import type { SalesContract } from "../../sales-contract-schemas";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

function Party({ title, party }: { title: string; party: SalesContract["seller"] }) {
  return (
    <div className="text-[0.8125rem]">
      <div className="text-ink-tertiary text-xs">{title}</div>
      <div className="text-ink-primary font-medium">{party.name}</div>
      {party.taxCode && <div className="text-ink-secondary">MST {party.taxCode}</div>}
      {party.address && <div className="text-ink-secondary">{party.address}</div>}
      {party.representative && (
        <div className="text-ink-secondary">
          {party.representative}
          {party.representativeTitle ? ` — ${party.representativeTitle}` : ""}
        </div>
      )}
    </div>
  );
}

/** Nội dung hợp đồng (đọc nguyên từ BE): bên bán / mua, tổng, lịch giao, lịch thanh toán, mốc thời gian. */
export function ContractSummary({
  contract,
  installments,
}: {
  contract: SalesContract;
  installments?: readonly ContractInstallmentFigures[];
}) {
  const money = (amount: number) => formatMoney(amount, contract.totals.currency);
  const facts: [string, ReactNode][] = [
    [
      "Tiền hàng",
      <span key="n" className={MONO}>
        {money(contract.totals.netAmount)}
      </span>,
    ],
    [
      "Thuế",
      <span key="t" className={MONO}>
        {money(contract.totals.taxAmount)}
      </span>,
    ],
    [
      "Tổng có thuế",
      <strong key="g" className={MONO}>
        {money(contract.totals.totalAmount)}
      </strong>,
    ],
    [
      "Số lần in mẫu miễn phí",
      `${contract.freeSampleRounds} ${ORDER_CONTRACT_LABELS.terms.rounds.unit}`,
    ],
    [
      "Thời hạn khiếu nại",
      contract.returnWindowDays != null
        ? `${contract.returnWindowDays} ngày`
        : `${DEFAULT_RETURN_WINDOW_DAYS} ngày (mặc định)`,
    ],
    ...(contract.sentAt
      ? [["Ngày gửi", formatDateTime(contract.sentAt)] as [string, ReactNode]]
      : []),
    ...(contract.signedOn
      ? [["Ngày ký", formatDate(contract.signedOn)] as [string, ReactNode]]
      : []),
    ...(contract.customerSignedAt
      ? [["Khách ký lúc", formatDateTime(contract.customerSignedAt)] as [string, ReactNode]]
      : []),
    ...(contract.signedFileName
      ? [["File đã ký", contract.signedFileName] as [string, ReactNode]]
      : []),
    ...(contract.cancellationReason
      ? [["Lý do huỷ", contract.cancellationReason] as [string, ReactNode]]
      : []),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Party title="Bên bán" party={contract.seller} />
        <Party title="Bên mua" party={contract.buyer} />
      </div>
      <dl className="grid grid-cols-[minmax(160px,auto)_1fr] gap-x-4 gap-y-1 text-[0.8125rem]">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-tertiary">{label}</dt>
            <dd className="text-ink-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <ContractTermsSummary contract={contract} />
      <ContractScheduleTables contract={contract} money={money} installments={installments} />
    </div>
  );
}
