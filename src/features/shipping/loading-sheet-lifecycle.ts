/**
 * Shipping — action-gating "Tải PDF" phiếu xếp hàng của xe mà chuyến là một (docs 09 §4.2 bước 5). Tách khỏi
 * `lifecycle.ts` để file đó không vượt giới hạn kích thước.
 */

import { LOAD_PLAN_PERMISSIONS, LOAD_STATUS } from "@/constants";

import type { ShippingActor } from "./lifecycle";
import type { Load } from "./types";

/**
 * Chuyến phải là một xe của kế hoạch, chưa huỷ, và người dùng có `fulfillment-load-plans:READ` (mã quyền của endpoint BE,
 * khác quyền xem chuyến). Chuyến chỉ có sau khi kế hoạch chốt nên kế hoạch đã CONFIRMED / DISPATCHED — đúng các trạng thái
 * BE cho tải PDF (docs 09 §4.2 bước 5, §5.3); chuyến huỷ có thể thuộc kế hoạch đã huỷ nên không hiện nút. Trả xe cần tải,
 * hoặc null khi không được tải. Backend phải re-check.
 */
export function loadingSheetOf(
  load: Pick<Load, "loadPlanId" | "vehicleSeq" | "status">,
  actor: ShippingActor,
): { loadPlanId: string; vehicleSeq: number } | null {
  if (
    !load.loadPlanId ||
    load.vehicleSeq == null ||
    load.status === LOAD_STATUS.CANCELLED ||
    !actor.can(LOAD_PLAN_PERMISSIONS.read)
  ) {
    return null;
  }
  return { loadPlanId: load.loadPlanId, vehicleSeq: load.vehicleSeq };
}
