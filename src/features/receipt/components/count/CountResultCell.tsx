import { RECEIPT_COUNT_LABELS } from "@/constants";
import { ToneDot } from "@/components/shared/column-helpers";

import { NUM } from "../primitives";

import type { CountResult } from "@/features/receipt/count-selectors";
import type { CountRow } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;
const RESULT_TONE = {
  full: "positive",
  short: "warning",
  over: "danger",
  none: "muted",
} as const satisfies Record<CountResult, "positive" | "warning" | "danger" | "muted">;

/** Ô "Đối chiếu" của dòng kiểm đếm: đủ / thiếu / thừa + "Đã đếm N/M thùng" và số cái. */
export function CountResultCell({
  row,
  total,
  result,
}: {
  row: Pick<CountRow, "maxCartons" | "unitsPerCarton">;
  total: number;
  result: CountResult;
}) {
  return (
    <td className="px-3 py-2">
      <ToneDot tone={RESULT_TONE[result]} label={C.result[result]} />
      {total > 0 && (
        <div className={`text-ink-tertiary mt-0.5 text-xs whitespace-nowrap ${NUM}`}>
          <div>{C.countedOfOpen(total, row.maxCartons)}</div>
          <div>{C.unitsOnly(total * row.unitsPerCarton)}</div>
        </div>
      )}
    </td>
  );
}
