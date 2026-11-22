import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { Notice } from "@/components/shared/Notice";

import { cartonTotals, holdOutcome } from "../../shipping-warehouse-rules";

import type { ShippingCoverage } from "../../shipping-warehouse-schemas";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.coverage;

/** Câu kết luận theo kết quả giữ hàng: đủ → quản lý kho release được; thiếu → phần còn lại giữ tiếp khi hàng nhập kho. */
function OutcomeNotice({ coverage }: { coverage: ShippingCoverage }) {
  const outcome = holdOutcome(coverage);
  const { held, cartons } = cartonTotals(coverage.lines);
  if (outcome === "full") return <Notice tone="positive">{L.full}</Notice>;
  if (outcome === "partial") return <Notice tone="warning">{L.partial(held, cartons)}</Notice>;
  return <Notice tone="info">{L.nothing}</Notice>;
}

/**
 * Tình trạng giữ hàng của đơn ở kho xuất (docs 17 §4.2 bước 3): kết luận chung, số thùng đã giữ theo từng dòng hàng và
 * — với đơn có lịch giao — theo từng đợt giao (đợt sớm nhất được giữ trước).
 */
export function CoverageSummary({ coverage }: { coverage: ShippingCoverage }) {
  return (
    <div className="mt-3 space-y-2.5">
      <OutcomeNotice coverage={coverage} />
      {coverage.lines.length > 0 && (
        <div>
          <h3 className="text-ink-secondary mb-1 text-xs font-medium">{L.lines}</h3>
          <ul className="space-y-0.5 text-xs">
            {coverage.lines.map((line) => (
              <li key={line.lineId} className="flex justify-between gap-2">
                <span className="text-ink-primary min-w-0 truncate">{line.sku}</span>
                <span className="text-ink-secondary tabular-nums">
                  {L.lineHeld(line.heldCartons, line.cartons)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {coverage.batches.length > 1 && (
        <div>
          <h3 className="text-ink-secondary mb-1 text-xs font-medium">{L.batches}</h3>
          <ul className="space-y-0.5 text-xs">
            {coverage.batches.map((batch) => (
              <li key={batch.seq} className="flex justify-between gap-2">
                <span className="text-ink-primary">{L.batchTitle(batch.seq)}</span>
                <span className="text-ink-secondary tabular-nums">
                  {batch.fullyHeld ? L.batchFull : L.batchShort(cartonTotals(batch.lines).short)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
