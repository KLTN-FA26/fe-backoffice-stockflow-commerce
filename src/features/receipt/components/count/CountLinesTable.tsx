"use client";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { ScrollShadowBox } from "@/components/backoffice/ScrollShadowBox";

import { CountLineRow } from "./CountLineRow";

import type { AreaOption } from "@/lib/references/warehouse-layout";
import type { CountRow } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;
const H = C.headers;
const HEADERS = [
  { label: H.sku, right: false },
  { label: H.production, right: true },
  { label: H.location, right: false },
  { label: H.cartons, right: false },
  { label: H.result, right: false },
];

/** Bảng kiểm đếm theo dòng Đơn sản xuất; rộng hơn khung thì cuộn ngang, có bóng ở mép còn cột. */
export function CountLinesTable({
  rows,
  areas,
  lot,
}: {
  rows: CountRow[];
  areas: readonly AreaOption[];
  lot: string;
}) {
  return (
    <ScrollShadowBox>
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{C.caption}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {HEADERS.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={`px-3 py-2 font-medium whitespace-nowrap ${h.right ? "text-right" : "text-left"}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <CountLineRow key={row.productionOrderLineId} index={index} areas={areas} lot={lot} />
          ))}
        </tbody>
      </table>
    </ScrollShadowBox>
  );
}
