"use client";

import { cn } from "cn";

import { PICK_LINE_LABELS, PICK_LINE_STATUS, PUT_BACK_LABELS } from "@/constants";
import { isConfirmableLine } from "@/features/fulfillment/pick-line-lifecycle";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, NUM } from "../primitives";

import type { PickLine } from "@/features/fulfillment/types";
import type { ReactNode } from "react";

const L = PICK_LINE_LABELS;
const COL = L.column;
const TH = "text-ink-secondary px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Bảng dòng lấy hàng theo lộ trình; dòng đang làm có `aria-current`, dòng Open có nút Chọn. Cột SL thiếu
 * chỉ hiện khi có dòng báo thiếu; `lineAction` thêm thao tác cuối dòng (vd phân bổ lại dòng thiếu).
 */
export function PickLinesTable({
  lines,
  activeLineId,
  onSelect,
  canSelect,
  lineAction,
}: {
  lines: readonly PickLine[];
  activeLineId: string | undefined;
  onSelect: (lineId: string) => void;
  canSelect: boolean;
  lineAction?: (line: PickLine) => ReactNode;
}) {
  const hasShort = lines.some((line) => line.shortQty > 0);
  const actions = lines.map((line) => lineAction?.(line) ?? null);
  const hasActionColumn = canSelect || actions.some(Boolean);
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full">
        <caption className="sr-only">{L.sectionTitle}</caption>
        <thead className="bg-bg-subtle border-border-default border-b">
          <tr>
            <th scope="col" className={TH}>
              {COL.sequence}
            </th>
            <th scope="col" className={TH}>
              {COL.location}
            </th>
            <th scope="col" className={TH}>
              {COL.sku}
            </th>
            <th scope="col" className={TH}>
              {COL.barcode}
            </th>
            <th scope="col" className={TH}>
              {COL.lot}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {COL.allocated}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {COL.picked}
            </th>
            {hasShort && (
              <th scope="col" className={`${TH} text-right`}>
                {L.shortColumn}
              </th>
            )}
            <th scope="col" className={TH}>
              {COL.status}
            </th>
            {hasActionColumn && <th scope="col" className={TH} aria-label={L.select} />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const active = line.lineId === activeLineId;
            return (
              <tr
                key={line.lineId}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "border-border-default border-b last:border-b-0",
                  active && "bg-bg-muted",
                )}
              >
                <td className={`${TD} text-ink-tertiary tabular-nums`}>{line.sequenceNo}</td>
                <td className={`${TD} text-ink-primary ${MONO}`}>{line.locationCode}</td>
                <td className={`${TD} text-ink-primary ${MONO}`}>{line.sku}</td>
                <td className={`${TD} text-ink-secondary ${MONO}`}>{line.barcode ?? "—"}</td>
                <td className={`${TD} text-ink-secondary`}>{line.lotNumber ?? "—"}</td>
                <td className={`${TD} text-ink-primary ${NUM}`}>{line.allocatedQty}</td>
                <td className={`${TD} text-ink-primary ${NUM}`}>{line.pickedQty}</td>
                {hasShort && (
                  <td className={`${TD} text-ink-primary ${NUM}`}>{line.shortQty || "—"}</td>
                )}
                <td className={TD}>
                  <StatusDot domain="pick" status={line.status} />
                  {line.status === PICK_LINE_STATUS.PUT_BACK && line.putBackLocationCode && (
                    <span className="text-ink-tertiary block text-xs">
                      {PUT_BACK_LABELS.returnedTo(line.putBackQty, line.putBackLocationCode)}
                    </span>
                  )}
                </td>
                {hasActionColumn && (
                  <td className={`${TD} text-right`}>
                    {canSelect && isConfirmableLine(line) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={L.selectLine(line.sequenceNo)}
                        onClick={() => onSelect(line.lineId)}
                        className="text-accent rounded-[var(--r-sm)]"
                      >
                        {L.select}
                      </Button>
                    )}
                    {actions[index]}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
