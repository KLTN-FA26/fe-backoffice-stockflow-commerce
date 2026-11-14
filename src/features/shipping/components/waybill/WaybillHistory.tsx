"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { useWaybillHistory } from "@/features/shipping/queries";
import { Skeleton } from "@/components/ui/skeleton";

import { MONO } from "../primitives";

const W = UI_LABELS.shipping.waybill.card;
const TH = "px-3 py-2 text-left font-medium whitespace-nowrap";

/**
 * Lịch sử đổi mã vận đơn của chuyến (BE `GET loads/{id}/waybill-history`, docs 09 §4.4, BR-24): mã cũ → mới, nguồn,
 * người, thời điểm, lý do; cũ nhất trước. Chỉ tải khi mở (`enabled`).
 */
export function WaybillHistory({ loadId }: { loadId: string }) {
  const query = useWaybillHistory(loadId, true);
  if (query.isPending) return <Skeleton className="h-16 w-full" />;
  if (query.isError || !query.data) {
    return <p className="text-ink-secondary text-[0.8125rem]">{W.historyLoadFailed}</p>;
  }
  if (query.data.length === 0) {
    return <p className="text-ink-secondary text-[0.8125rem]">{W.historyEmpty}</p>;
  }
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{W.history}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th scope="col" className={TH}>
              {W.historyWhen}
            </th>
            <th scope="col" className={TH}>
              {W.historyOld}
            </th>
            <th scope="col" className={TH}>
              {W.historyNew}
            </th>
            <th scope="col" className={TH}>
              {W.historySource}
            </th>
            <th scope="col" className={TH}>
              {W.historyWho}
            </th>
            <th scope="col" className={TH}>
              {W.historyReason}
            </th>
          </tr>
        </thead>
        <tbody>
          {query.data.map((change, index) => (
            <tr
              key={`${change.changedAt}-${index}`}
              className="border-border-default border-t align-top"
            >
              <td className="text-ink-secondary px-3 py-2 whitespace-nowrap tabular-nums">
                {formatDateTime(change.changedAt)}
              </td>
              <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>
                {change.oldWaybillNo ?? "—"}
              </td>
              <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>
                {change.newWaybillNo ?? <span className="font-sans">{W.historyRemoved}</span>}
              </td>
              <td className="text-ink-secondary px-3 py-2">{W.source[change.source]}</td>
              <td className="text-ink-secondary px-3 py-2">
                {change.changedByName ?? (change.source === "WEBHOOK" ? W.historyCarrier : "—")}
              </td>
              <td className="text-ink-secondary px-3 py-2">{change.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
