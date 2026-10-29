import Link from "next/link";

import { ADMIN_ROUTES, LOAD_STATUS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { Load } from "@/features/shipping/types";

const N = UI_LABELS.shipping.ftl.controlledCancel.cancelledBanner;
const CODES = UI_LABELS.shipping.ftl.controlledCancel.reasonCode;

/**
 * Xe đã huỷ có kiểm soát (SCRUM-474 UNLOAD-DESIGN): mã lý do + ghi chú, và lối sang kế hoạch — chuyến thay thế (Chưa đặt xe,
 * cùng sơ đồ xếp) nằm ở xe tương ứng của kế hoạch. Kiện còn phải dỡ do `UnloadPanel` hiện.
 */
export function ControlledCancelNotice({ load }: { load: Load }) {
  if (load.status !== LOAD_STATUS.CANCELLED || !load.cancelReasonCode) return null;
  return (
    <Alert tone="warning" title={N.title}>
      <p>
        {N.reason} <strong>{CODES[load.cancelReasonCode]}</strong>
        {load.cancelReason ? ` — ${load.cancelReason}` : ""}
      </p>
      {load.loadPlanId && (
        <p className="mt-1">
          {N.replacement}{" "}
          <Link
            href={ADMIN_ROUTES.loadPlans.detail(load.loadPlanId)}
            className="text-accent hover:underline"
          >
            {load.loadPlanCode ?? load.loadPlanId}
          </Link>
        </p>
      )}
    </Alert>
  );
}
