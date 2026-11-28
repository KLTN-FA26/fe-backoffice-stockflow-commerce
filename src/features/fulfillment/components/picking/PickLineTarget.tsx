import { PICK_LINE_LABELS } from "@/constants";

import { MONO } from "../primitives";

import type { PickLine } from "@/features/fulfillment/types";

const L = PICK_LINE_LABELS;

/** Đầu thẻ xác nhận dòng: đi đâu (vị trí), lấy thùng nào (LPN), hàng gì. Không có số lượng (mỗi dòng một thùng, BR-04). */
export function PickLineTarget({ line }: { line: PickLine }) {
  return (
    <div>
      <h2 className="text-ink-primary text-sm font-semibold">{L.confirmTitle(line.sequenceNo)}</h2>
      <dl className="mt-1.5 space-y-1 text-[0.8125rem]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-secondary">{L.targetLocation}</dt>
          <dd className={`text-ink-primary text-base font-semibold ${MONO}`}>
            {line.locationCode}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-secondary">{L.targetLpn}</dt>
          <dd className={`text-ink-primary font-medium ${MONO}`}>{line.lpn ?? "—"}</dd>
        </div>
      </dl>
      <p className="text-ink-secondary mt-1 text-xs">
        {line.allocatedQty} × {line.sku}
        {line.lotNumber ? ` · ${L.lot(line.lotNumber)}` : ""}
      </p>
    </div>
  );
}
