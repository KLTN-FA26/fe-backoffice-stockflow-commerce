"use client";

import { UI_LABELS } from "@/constants";
import { isLineComplete } from "@/features/fulfillment/carton-check-selectors";

import { MONO, Section } from "../primitives";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck.lines;
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Dòng hàng của đơn và tiến độ của từng dòng (docs 08 §3, §4.4 bước 8.3): số cái cần của đợt giao của task, số thùng,
 * đã quét, đã dán nhãn, đã loại, đã vào shipment, và còn thiếu bao nhiêu cái.
 */
export function CartonLinesSection({ session }: { session: CartonCheckSession }) {
  return (
    <Section title={L.title} description={L.description}>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full">
          <caption className="sr-only">{L.title}</caption>
          <thead className="bg-bg-subtle border-border-default border-b">
            <tr>
              <th scope="col" className={`${TH} text-left`}>
                {L.sku}
              </th>
              {[
                L.wanted,
                L.cartons,
                L.checked,
                L.labeled,
                L.removed,
                L.shipped,
                L.labeledUnits,
                L.missing,
              ].map((header) => (
                <th key={header} scope="col" className={`${TH} text-right`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.lines.map((line) => (
              <tr key={line.orderLineId} className="border-border-default border-b last:border-b-0">
                <td className={`${TD} text-ink-primary ${MONO}`}>{line.sku}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.wantedUnits}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.cartons}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.checkedCartons}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.labeledCartons}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.removedCartons}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.shippedCartons}</td>
                <td className={`${TD} text-right ${MONO}`}>{line.labeledUnits}</td>
                <td className={`${TD} text-right ${MONO}`}>
                  {isLineComplete(line) ? (
                    <span className="text-positive">{L.done}</span>
                  ) : (
                    <span className="text-warning">{line.wantedUnits - line.labeledUnits}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
