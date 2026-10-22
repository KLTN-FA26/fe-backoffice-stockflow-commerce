import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { LoadPlanActions } from "@/features/load-planning/lifecycle";
import type { PlanDetail } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.detail;

/**
 * Các thông báo đầu trang: lỗi của thao tác không nằm trong hộp thoại (tính lại xe, 409 OPTIMISTIC_LOCK đã tải
 * lại…), tải lại ngầm thất bại, xe cần tính lại, và lý do trang chỉ xem (thiếu quyền hoặc kế hoạch đã kết thúc).
 */
export function PlanNotices({
  plan,
  actions,
  notice,
  refetchFailed,
  final,
  onRetry,
  onDismiss,
}: {
  plan: PlanDetail;
  actions: LoadPlanActions;
  notice: string | null;
  refetchFailed: boolean;
  final: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const canWrite = Object.values(actions).some((value) => value === true);
  const needsRecalc = plan.vehicles.some((vehicle) => vehicle.needsRecalculation);
  return (
    <div className="space-y-2 empty:hidden">
      {notice && (
        <Alert tone="danger">
          {notice}{" "}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onDismiss}>
            {UI_LABELS.loadPlan.detail.dismiss}
          </Button>
        </Alert>
      )}
      {refetchFailed && (
        <Alert tone="warning">
          {L.refetchFailed}{" "}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
            {UI_LABELS.common.retry}
          </Button>
        </Alert>
      )}
      {needsRecalc && !final && <Alert tone="warning">{L.needsRecalculationAlert}</Alert>}
      {final && <Alert tone="info">{L.finalState}</Alert>}
      {!final && !canWrite && <Alert tone="info">{L.viewOnly}</Alert>}
    </div>
  );
}
