"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";

import { CodeLink, EMPTY, MONO, When } from "./primitives";

import type { ReturnParcel } from "../types";

const D = RETURN_LABELS.detail;

/**
 * Các lần hàng về của yêu cầu (WF-05 TH-3; BE `ReturnRequestResponse.receipt.parcels`, lần đầu trước): mỗi lần là một
 * phiếu nhập hàng hoàn đã xác nhận — số phiếu (mở chi tiết phiếu), lúc nhận, người nhận.
 */
export function ReturnParcelList({ parcels }: { parcels: readonly ReturnParcel[] }) {
  if (parcels.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-ink-secondary text-xs font-medium">{D.parcels}</h4>
      <ol aria-label={D.parcels} className="divide-y divide-[var(--table-line)]">
        {parcels.map((parcel) => (
          <li
            key={`${parcel.parcel}-${parcel.goodsReceiptId ?? ""}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
          >
            <span className="text-ink-tertiary">{D.parcel(parcel.parcel)}</span>
            {parcel.goodsReceiptId ? (
              <CodeLink href={RETURN_ROUTES.receipts.detail(parcel.goodsReceiptId)}>
                {parcel.receiptNumber ?? D.receiptLink}
              </CodeLink>
            ) : (
              <span className={MONO}>{parcel.receiptNumber ?? EMPTY}</span>
            )}
            <When iso={parcel.receivedAt} />
            {parcel.receivedBy && (
              <span className="text-ink-secondary">
                {D.parcelReceiver}{" "}
                <span className={MONO} title={parcel.receivedBy}>
                  {parcel.receivedBy.slice(0, 8)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
