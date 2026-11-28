"use client";

import { RETURN_RECEIVING_LABELS } from "@/constants/labels-return-receiving";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";

import { progressPercent } from "../receiving";

import { MONO } from "./primitives";

import type { RmaReceiving } from "../receiving";
import type { ReturnProgress } from "../types";

const P = RETURN_RECEIVING_LABELS.progress;
const TH = "py-1 pr-3 font-medium";
const NUM = `py-1.5 pr-3 text-right ${MONO}`;

function Bar({ row }: { row: ReturnProgress }) {
  const percent = progressPercent(row);
  return (
    <div
      role="progressbar"
      aria-label={P.bar(row.sku, percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="bg-bg-muted h-1.5 w-24 overflow-hidden rounded-full"
    >
      <div className="bg-accent h-full" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * Hàng được duyệt trả của yêu cầu, một dòng mỗi SKU (WF-05 BE-22, Q-11): đã duyệt · đã nhận trên phiếu trước (chính thức)
 * · trên phiếu này · còn nhận được — số của BE (`returnProgress`), cùng số BE dùng để chặn khi quét và ghi hàng lẻ. Phiếu
 * NHÁP: số trên phiếu là đang đếm, chưa chính thức; đủ số thì chỉ nói "đếm xong, còn phải xác nhận" — yêu cầu chưa sang
 * "Hàng đã về" trước khi phiếu được xác nhận.
 */
export function ReturnProgressCard({
  progress,
  draft,
}: {
  progress: RmaReceiving;
  draft: boolean;
}) {
  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-ink-primary text-sm font-semibold">{P.title}</h2>
        <p className="text-ink-tertiary text-xs">{P.description}</p>
      </div>
      {progress.rows.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{P.none}</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{P.title}</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className={TH}>
                {P.sku}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {P.approved}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {P.confirmed}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {draft ? P.currentDraft : P.currentClosed}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {P.remaining}
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">%</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {progress.rows.map((row) => (
              <tr key={row.sku}>
                <td className={`py-1.5 pr-3 ${MONO}`}>{row.sku}</td>
                <td className={NUM}>{row.approvedQuantity}</td>
                <td className={NUM}>{row.confirmedReceivedQuantity}</td>
                <td className={NUM}>{row.currentReceiptQuantity}</td>
                <td className={`${NUM} font-semibold`}>{row.remainingQuantity}</td>
                <td className="py-1.5">
                  <Bar row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {progress.countedAwaitingConfirmation ? (
        <Notice tone="info">{P.countedAwaitingConfirmation}</Notice>
      ) : (
        progress.complete && !draft && <Notice tone="positive">{P.complete}</Notice>
      )}
      {draft && progress.current > 0 && !progress.countedAwaitingConfirmation && (
        <p className="text-ink-tertiary text-xs">{P.draftNote}</p>
      )}
    </Card>
  );
}
