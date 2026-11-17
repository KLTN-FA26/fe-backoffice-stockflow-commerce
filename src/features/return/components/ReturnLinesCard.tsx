"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { Card } from "@/components/shared/Card";

import { EMPTY, MONO, Money } from "./primitives";

import type { ReturnRequest } from "../types";

const D = RETURN_LABELS.detail;
const NUM = `${MONO} text-right`;
const qty = (value: number | null | undefined) => (value == null ? EMPTY : value);

/** Từng dòng: yêu cầu → duyệt → đã về → hoàn (BE `ReturnRequestResponse.Line`). */
export function ReturnLinesCard({ ret }: { ret: ReturnRequest }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.lines}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{D.lines}</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                {D.sku}
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {D.unitPrice}
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {D.requested}
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {D.approved}
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {D.received}
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {D.refunded}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {D.refundAmount}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {ret.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-1.5 pr-3">
                  <span className={MONO}>{line.sku}</span>
                  {line.customPrinted && (
                    <span className="text-ink-tertiary ml-2 text-xs">{D.printed}</span>
                  )}
                </td>
                <td className={`py-1.5 pr-3 ${NUM}`}>
                  <Money amount={line.unitPrice} currency={ret.currency} />
                </td>
                <td className={`py-1.5 pr-3 ${NUM}`}>{line.requestedQuantity}</td>
                <td className={`py-1.5 pr-3 ${NUM}`}>{qty(line.approvedQuantity)}</td>
                <td className={`py-1.5 pr-3 ${NUM}`}>{qty(line.receivedQuantity)}</td>
                <td className={`py-1.5 pr-3 ${NUM}`}>{line.refundQuantity || EMPTY}</td>
                <td className={`py-1.5 ${NUM}`}>
                  <Money amount={line.refundAmount} currency={ret.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(ret.discrepancies ?? []).length > 0 && (
        <p className="text-ink-secondary text-xs">
          {D.discrepancies}:{" "}
          {(ret.discrepancies ?? [])
            .map((d) => `${d.kind} ${d.sku ?? ""} × ${d.quantity}`)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}
