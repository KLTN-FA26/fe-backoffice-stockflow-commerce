"use client";

import { SALES_CONTRACT_STATUS_LABELS, SALES_CONTRACT_STATUS_TONE_KEY } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { StatusDot } from "@/components/shared/StatusDot";

import { useSalesContractHistory } from "../../sales-contract-queries";

/** Lịch sử hợp đồng của đơn (`GET …/contract/history`) — mọi bản, kể cả bản đã huỷ. */
export function ContractHistory({ orderId }: { orderId: string }) {
  const history = useSalesContractHistory(orderId, true);
  if (history.isPending)
    return <p className="text-ink-tertiary text-[0.8125rem]">Đang tải lịch sử…</p>;
  if (history.isError)
    return (
      <p className="text-danger text-[0.8125rem]">
        Không tải được lịch sử hợp đồng.{" "}
        <button type="button" className="underline" onClick={() => void history.refetch()}>
          Thử lại
        </button>
      </p>
    );
  if (history.data.length === 0)
    return <p className="text-ink-tertiary text-[0.8125rem]">Chưa có bản nào.</p>;
  return (
    <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
      {history.data.map((version) => (
        <li key={version.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
          <span className="font-[family-name:var(--font-mono)]">{version.contractNumber}</span>
          <StatusDot
            domain="order"
            status={SALES_CONTRACT_STATUS_TONE_KEY[version.status]}
            label={SALES_CONTRACT_STATUS_LABELS[version.status]}
          />
          <span className="tabular-nums">
            {formatMoney(version.totals.totalAmount, version.totals.currency)}
          </span>
          {version.sentAt && (
            <span className="text-ink-tertiary">gửi {formatDateTime(version.sentAt)}</span>
          )}
          {version.cancellationReason && (
            <span className="text-ink-secondary">Lý do huỷ: {version.cancellationReason}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
