"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { shortChecksum, shortId } from "@/features/fulfillment/selectors";

import { MONO } from "../primitives";

import type { IntegrityEvidence } from "@/features/fulfillment/types";

const INTEGRITY = UI_LABELS.fulfillment.integrity;
const TH = "text-ink-secondary px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Lịch sử đối chiếu checksum (append-only, mới nhất trước) — bằng chứng của flow X-CHK:
 * checksum đã chốt trên dòng đơn so với file thật trong kho lưu trữ.
 */
export function EvidenceTable({
  evidence,
  skuByLine,
}: {
  evidence: readonly IntegrityEvidence[];
  /** id dòng đơn → SKU, khi đọc được đơn hàng. */
  skuByLine: Readonly<Record<string, string>>;
}) {
  if (evidence.length === 0) {
    return <p className="text-ink-tertiary text-[0.8125rem]">Chưa có lần đối chiếu nào.</p>;
  }
  return (
    <div className="border-border-default max-h-80 overflow-auto rounded-[var(--r-sm)] border">
      <table className="w-full">
        <caption className="sr-only">Lịch sử đối chiếu checksum thiết kế</caption>
        <thead className="bg-bg-subtle border-border-default sticky top-0 border-b">
          <tr>
            <th scope="col" className={TH}>
              Thời điểm
            </th>
            <th scope="col" className={TH}>
              Dòng
            </th>
            <th scope="col" className={TH}>
              Checksum đã chốt
            </th>
            <th scope="col" className={TH}>
              Checksum thực tế
            </th>
            <th scope="col" className={TH}>
              Kết quả
            </th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((entry) => (
            <tr
              key={`${entry.orderLineId}-${entry.verifiedAt}`}
              className={`border-border-default border-b last:border-b-0 ${entry.matching ? "" : "bg-danger/5"}`}
            >
              <td className={`${TD} text-ink-secondary tabular-nums`}>
                {formatDateTime(entry.verifiedAt)}
              </td>
              <td className={`${TD} text-ink-primary ${MONO}`} title={entry.orderLineId}>
                {skuByLine[entry.orderLineId] ?? shortId(entry.orderLineId)}
              </td>
              <td className={`${TD} text-ink-primary ${MONO}`} title={entry.expectedChecksum}>
                {shortChecksum(entry.expectedChecksum)}…
              </td>
              <td className={`${TD} text-ink-primary ${MONO}`} title={entry.actualChecksum}>
                {shortChecksum(entry.actualChecksum)}…
              </td>
              <td
                className={`${TD} ${entry.matching ? "text-positive" : "text-danger font-medium"}`}
              >
                {entry.matching ? INTEGRITY.match : INTEGRITY.mismatch}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
