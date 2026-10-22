import { LOAD_PLAN_ESTIMATE_FLAG_LABELS, UI_LABELS } from "@/constants";
import { knownFlags } from "@/features/load-planning/reconciliation-schemas";
import { Alert } from "@/components/shared/Alert";

import { Counts, Measures } from "./EstimateTables";

import type { EstimateComparison } from "@/features/load-planning/plan-types";

const R = UI_LABELS.loadPlan.detail.reconciliation;

/**
 * So kế hoạch với ước lượng HIỆN HÀNH của từng đơn (BE `vsEstimate`): CHỈ để tham khảo — cờ hiện như cảnh báo mềm, không
 * chặn chốt. Số xe chỉ so khi kế hoạch có một đơn; kế hoạch nhiều đơn chỉ liệt kê số xe mỗi ước lượng cần.
 */
export function EstimateComparisonPanel({ vs }: { vs: EstimateComparison | null | undefined }) {
  if (!vs) return <p className="text-ink-tertiary text-sm">{R.noEstimate}</p>;
  const flags = knownFlags(vs.flags);
  return (
    <div className="space-y-3">
      <p className="text-ink-tertiary text-xs">{R.advisory}</p>
      {flags.length === 0 ? (
        <Alert tone="info">{R.noFlags}</Alert>
      ) : (
        <ul className="space-y-1.5">
          {flags.map((flag) => (
            <li key={flag}>
              <Alert tone="warning">{LOAD_PLAN_ESTIMATE_FLAG_LABELS[flag]}</Alert>
            </li>
          ))}
        </ul>
      )}
      {vs.notEstimated.length > 0 && (
        <p className="text-ink-secondary text-[0.8125rem]">
          {R.notEstimated(vs.notEstimated.length)}
        </p>
      )}
      {/* Không đơn nào có ước lượng: BE bỏ thể tích / khối lượng / từng dòng, chỉ còn cờ NO_ESTIMATE */}
      {vs.estimateIds.length > 0 && (
        <>
          {(vs.volumeMm3 || vs.weightKg) && (
            <div className="border-border-default overflow-x-auto rounded border">
              <Measures vs={vs} />
            </div>
          )}
          <div className="border-border-default overflow-x-auto rounded border">
            {vs.vehiclesCompared ? (
              <Counts
                head={R.vehiclesByType}
                rows={vs.vehiclesByType.map((v) => ({ key: v.code, label: v.code, ...v }))}
              />
            ) : (
              <p className="text-ink-tertiary p-3 text-xs">{R.vehiclesNotCompared}</p>
            )}
          </div>
          {vs.cartonsByLine.length > 0 && (
            <div className="border-border-default overflow-x-auto rounded border">
              <Counts
                head={R.cartons}
                rows={vs.cartonsByLine.map((line) => ({
                  key: line.orderLineId,
                  label: line.sku,
                  estimated: line.estimated,
                  actual: line.actual,
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
