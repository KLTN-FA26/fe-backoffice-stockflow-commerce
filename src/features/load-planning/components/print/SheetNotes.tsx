import { cn } from "cn";

import { LOAD_PLAN_PRINT_LABELS, LOAD_PLAN_UNPLACED_REASON_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { formatNominalCm } from "../../lib/dims";
import { Alert } from "@/components/shared/Alert";
import { PRINT_EXACT, SECTION_TITLE, TABLE_FRAME, TD, TH } from "./primitives";

import type { PrintUnplaced } from "../../lib/print-sheet";

const U = LOAD_PLAN_PRINT_LABELS.unplaced;
const G = LOAD_PLAN_PRINT_LABELS.signatures;

/** Ghi chú kiện chưa lên xe nào (khay chưa xếp / đã để lại) — người xếp hàng cần biết phiếu này KHÔNG có các kiện đó. */
export function UnplacedNote({ unplaced }: { unplaced: PrintUnplaced }) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h3 className={SECTION_TITLE}>{U.title}</h3>
      <Alert tone="warning">
        <div className="space-y-1">
          <p>{U.left(unplaced.count)}</p>
          <p>{unplaced.acknowledged ? U.acknowledged : U.notAcknowledged}</p>
          {unplaced.reasons.length > 0 && (
            <p>
              {U.reason}:{" "}
              {unplaced.reasons
                .map((reason) => LOAD_PLAN_UNPLACED_REASON_LABELS[reason])
                .join("; ")}
            </p>
          )}
        </div>
      </Alert>
      <div className={TABLE_FRAME}>
        <table className="w-full text-[0.75rem]">
          <caption className="sr-only">{U.title}</caption>
          <thead className={cn("bg-bg-subtle text-ink-secondary text-left", PRINT_EXACT)}>
            <tr>
              <th scope="col" className={TH}>
                {U.item}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {LOAD_PLAN_PRINT_LABELS.parcel.size}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {U.quantity}
              </th>
            </tr>
          </thead>
          <tbody>
            {unplaced.lines.map((line) => (
              <tr
                key={`${line.partName}|${formatNominalCm(line.origMm)}`}
                className="border-border-default border-t"
              >
                <td className={TD}>{line.partName}</td>
                <td className={cn(TD, "text-right tabular-nums")}>
                  {formatNominalCm(line.origMm)}
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatNumber(line.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Ba ô ký (thủ kho / tài xế / người kiểm hàng) — một khối, không bị tách trang. */
export function SignatureBoxes() {
  return (
    <div className="grid break-inside-avoid grid-cols-3 gap-4 pt-2">
      {[G.warehouse, G.driver, G.checker].map((title) => (
        <div
          key={title}
          className="border-border-default flex min-h-28 flex-col rounded-[var(--r-sm)] border p-3 text-center"
        >
          <div className="text-ink-primary text-[0.8125rem] font-semibold">{title}</div>
          <div className="text-ink-tertiary text-xs">({G.note})</div>
        </div>
      ))}
    </div>
  );
}
