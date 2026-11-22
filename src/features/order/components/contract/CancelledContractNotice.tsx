"use client";

import { Notice } from "@/components/shared/Notice";

import { useSalesContractHistory } from "../../sales-contract-queries";

/**
 * `GET …/contract` never returns a CANCELLED contract (it 404s once cancelled), so the reason lives in the history:
 * show the latest cancelled version's number and reason when the order has no live contract.
 */
export function CancelledContractNotice({ orderId }: { orderId: string }) {
  const history = useSalesContractHistory(orderId, true);
  const cancelled = history.data
    ?.filter((version) => version.status === "CANCELLED")
    .sort((a, b) => (b.cancelledAt ?? "").localeCompare(a.cancelledAt ?? ""))[0];
  if (!cancelled) return null;
  return (
    <Notice tone="info">
      Hợp đồng {cancelled.contractNumber} đã huỷ
      {cancelled.cancellationReason ? `: ${cancelled.cancellationReason}` : ""}. Khách muốn sửa hợp
      đồng đã gửi → huỷ (ghi lý do) rồi lập lại.
    </Notice>
  );
}
