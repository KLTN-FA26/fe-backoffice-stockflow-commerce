"use client";

import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { MONO } from "../copy";

import type { MaterialIssue } from "@/features/production-order/types";

/** Các lần xuất phôi của một LSX (`GET /production/orders/{id}/material-issues`). */
export function IssueHistory({ issues }: { issues: readonly MaterialIssue[] }) {
  if (issues.length === 0)
    return <p className="text-ink-tertiary text-[0.8125rem]">Chưa xuất phôi lần nào.</p>;
  return (
    <table className="w-full text-[0.8125rem]">
      <caption className="sr-only">Các lần xuất phôi</caption>
      <thead className="text-ink-tertiary text-left">
        <tr>
          <th scope="col" className="py-1">
            Thời điểm
          </th>
          <th scope="col">Phôi / lô</th>
          <th scope="col">Từ → tới</th>
          <th scope="col" className="text-right">
            SL
          </th>
        </tr>
      </thead>
      <tbody>
        {issues.map((row) => (
          <tr key={row.id} className="border-border-default border-t">
            <td className="py-1 tabular-nums">{formatDateTime(row.issuedAt)}</td>
            <td className={MONO}>
              {row.sku}
              {row.lotNumber ? ` · ${row.lotNumber}` : ""}
            </td>
            <td className={MONO}>
              {row.fromLocation} → {row.toLocation}
            </td>
            <td className={`text-right ${MONO}`}>{formatNumber(row.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
