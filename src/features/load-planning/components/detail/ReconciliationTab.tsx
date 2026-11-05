"use client";

import { UI_LABELS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { useLoadPlanReconciliation } from "@/features/load-planning/queries";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/ui/skeleton";

import { EstimateComparisonPanel } from "./EstimateComparisonPanel";
import { PieceCheckTable } from "./PieceCheckTable";

const R = UI_LABELS.loadPlan.detail.reconciliation;

/** Tab "Đối chiếu": sổ kép số kiện (`pieceCheck`) và so với ước lượng (`vsEstimate`, chỉ tham khảo). */
export function ReconciliationTab({ loadPlanId }: { loadPlanId: string }) {
  // Mọi mutation làm mới khoá gốc nên tab tự đọc lại sau mỗi thay đổi của kế hoạch
  const query = useLoadPlanReconciliation(loadPlanId, true);
  if (query.isPending) return <Skeleton className="h-32 w-full" aria-label={R.pieceCheck} />;
  if (query.isError) return <Alert tone="danger">{loadPlanErrorMessage(query.error)}</Alert>;
  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label={R.pieceCheck}>
        <h3 className="text-ink-primary text-sm font-medium">{R.pieceCheck}</h3>
        <p className="text-ink-tertiary text-xs">{R.pieceCheckHint}</p>
        <PieceCheckTable data={query.data} />
      </section>
      <section className="space-y-2" aria-label={R.vsEstimate}>
        <h3 className="text-ink-primary text-sm font-medium">{R.vsEstimate}</h3>
        <EstimateComparisonPanel vs={query.data.vsEstimate} />
      </section>
    </div>
  );
}
