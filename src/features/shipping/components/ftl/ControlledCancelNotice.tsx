import Link from "next/link";

import { ADMIN_ROUTES, LOAD_STATUS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { Load } from "@/features/shipping/types";

const N = UI_LABELS.shipping.ftl.controlledCancel.cancelledBanner;
const CODES = UI_LABELS.shipping.ftl.controlledCancel.reasonCode;
const A = UI_LABELS.shipping.afterHandover;

/**
 * Xe đã huỷ có kiểm soát (SCRUM-474 UNLOAD-DESIGN): mã lý do + ghi chú, và — chỉ khi BE báo có — liên kết tới chuyến thay thế
 * (Chưa đặt xe, cùng sơ đồ xếp hoặc sơ đồ tính lại khi có lô gỡ khỏi xe) kèm liên kết in lại sơ đồ xếp của xe. Huỷ cả kế hoạch hay xe không còn gì để chở thì không có chuyến thay thế nên không nói tới.
 * Kiện còn phải dỡ do `UnloadPanel` hiện.
 */
export function ControlledCancelNotice({ load }: { load: Load }) {
  if (load.status !== LOAD_STATUS.CANCELLED || !load.cancelReasonCode) return null;
  return (
    <Alert tone="warning" title={N.title}>
      <p>
        {N.reason} <strong>{CODES[load.cancelReasonCode]}</strong>
        {load.cancelReason ? ` — ${load.cancelReason}` : ""}
      </p>
      {load.replacementLoadId && (
        <p className="mt-1">
          {N.replacement}{" "}
          <Link
            href={ADMIN_ROUTES.loads.detail(load.replacementLoadId)}
            className="text-accent-text hover:underline"
          >
            {load.replacementLoadCode ?? load.replacementLoadId}
          </Link>
          {/* Docs 09 §4.2 bước 9: xe dùng sơ đồ tính lại khi có lô gỡ khỏi xe — in lại phiếu sơ đồ của xe */}
          {load.loadPlanId && load.vehicleSeq != null && (
            <>
              {" · "}
              <Link
                href={ADMIN_ROUTES.loadPlans.print(load.loadPlanId, load.vehicleSeq)}
                className="text-accent-text hover:underline"
              >
                {A.reprintLayout}
              </Link>
            </>
          )}
        </p>
      )}
    </Alert>
  );
}
