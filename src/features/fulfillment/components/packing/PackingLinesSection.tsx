"use client";

import { UI_LABELS } from "@/constants";
import { leftToPack } from "@/features/fulfillment/packing-selectors";

import { MONO, Section } from "../primitives";

import type { PackLine, PackingSession } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing.lines;
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

function Tag({ children }: { children: string }) {
  return (
    <span className="border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem]">
      {children}
    </span>
  );
}

function LineRow({ line }: { line: PackLine }) {
  const short = line.available < line.wanted;
  const left = leftToPack(line);
  return (
    <tr className="border-border-default border-b last:border-b-0">
      <td className={`${TD} text-ink-primary`}>
        <div className={`font-medium ${MONO}`}>{line.sku}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {line.printLine && <Tag>{L.printLine}</Tag>}
          {line.lotTracked && <Tag>{L.lotTracked}</Tag>}
          {line.serialTracked && <Tag>{L.serialTracked}</Tag>}
        </div>
      </td>
      <td className={`${TD} text-ink-secondary ${MONO}`}>{line.barcode ?? "—"}</td>
      <td className={`${TD} text-right ${MONO}`}>{line.wanted}</td>
      <td className={`${TD} text-right ${MONO} ${short ? "text-warning font-medium" : ""}`}>
        {line.available}
      </td>
      <td className={`${TD} text-right ${MONO}`}>{line.packed}</td>
      <td className={`${TD} text-right ${MONO}`}>{line.shipped}</td>
      <td
        className={`${TD} text-right ${MONO} ${line.remaining === 0 ? "text-positive" : "text-ink-primary font-medium"}`}
        title={short ? L.shortOfPicked(line.available, line.wanted) : undefined}
      >
        {line.remaining === 0 ? L.done : line.remaining}
        {line.remaining > 0 && left < line.remaining && (
          <span className="text-warning block text-[0.6875rem] font-normal">
            {L.shortOfPicked(line.available, line.wanted)}
          </span>
        )}
      </td>
      <td className={`${TD} text-ink-secondary`}>
        {line.lots.length === 0
          ? "—"
          : line.lots.map((lot) => (
              <div key={lot.lotNumber} className={MONO}>
                {L.lotCell(lot.lotNumber, lot.packed, lot.available)}
              </div>
            ))}
      </td>
    </tr>
  );
}

/** Dòng hàng của đơn: số cần, đã về bàn, đã đóng, đã giao, còn lại và lô đã lấy (BE `PackingSessionResponse.Line`). */
export function PackingLinesSection({ session }: { session: PackingSession }) {
  return (
    <Section title={L.title} description={L.description}>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full min-w-[40rem]">
          <caption className="sr-only">{L.title}</caption>
          <thead className="bg-bg-subtle border-border-default border-b">
            <tr>
              <th scope="col" className={`${TH} text-left`}>
                {L.sku}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.barcode}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.wanted}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.available}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.packed}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.shipped}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {L.remaining}
              </th>
              <th scope="col" className={`${TH} text-left`}>
                {L.lots}
              </th>
            </tr>
          </thead>
          <tbody>
            {session.lines.map((line) => (
              <LineRow key={line.orderLineId} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
