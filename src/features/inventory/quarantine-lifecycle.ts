import {
  QUARANTINE_ACTION,
  QUARANTINE_LABELS,
  QUARANTINE_PACKAGE_STATUS_IN_STOCK,
  QUARANTINE_STOCK_STATUS,
  RETURN_OWNERSHIP_CUSTOMER,
  RETURN_OWNERSHIP_PENDING,
} from "@/constants/quarantine";
import { INVENTORY_PERMISSIONS, STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import { STOCK_PACKAGE_API_STATUSES, STOCK_PACKAGE_STATUS_BY_API } from "@/constants/statuses";

import type { StockPackageDetail } from "./quarantine-types";
import type { PermissionCode } from "@/lib/auth";

export type QuarantineAction = (typeof QUARANTINE_ACTION)[keyof typeof QUARANTINE_ACTION];

// Trạng thái thùng BE → chuỗi của StatusDot; VOID (không có trong bảng) và mã lạ hiện nguyên văn.
export function cartonStatusLabel(status: string): string {
  const known = STOCK_PACKAGE_API_STATUSES.find((value) => value === status);
  return known ? STOCK_PACKAGE_STATUS_BY_API[known] : status;
}

// Docs 20 §5.1: the stock of a carton is `Quarantine` when what it holds is; the carton itself stays `In Stock`.
export function isQuarantined(carton: StockPackageDetail): boolean {
  return (carton.contents ?? []).some((row) => row.status === QUARANTINE_STOCK_STATUS);
}

// Docs 20 §4.8 bước 2: only a free carton is quarantined — one held for an order is released / reallocated first.
export function isHeldForOrder(carton: StockPackageDetail): boolean {
  return carton.reserved > 0;
}

/**
 * WF-05 BE-24 / Q-18: a returned carton that came back opened (fewer than its label) is never released for sale — custom
 * printed, not resellable; it is only written off. `CartonQuarantineService#release` refuses it (`RETURN_CARTON_OPENED`).
 */
export function isOpenedOnReturn(carton: Pick<StockPackageDetail, "openedOnReturn">): boolean {
  return carton.openedOnReturn === true;
}

/**
 * Câu giải thích cho thùng về đã mở (BE G4 `StockPackageDetailResponse.openedOnReturn`): từ Q-18 thùng mở KHÔNG nhập lại
 * tồn (giữ CONSUMED, hàng huỷ theo phiếu nhập hàng hoàn); thùng nhận trước Q-18 đang nằm cách ly thì chỉ ghi giảm. `null` =
 * không phải thùng về đã mở.
 */
export function openedOnReturnNotice(
  carton: Pick<StockPackageDetail, "openedOnReturn" | "status">,
): "openedOnReturnNotice" | "openedOnReturnConsumed" | null {
  if (!isOpenedOnReturn(carton)) return null;
  return carton.status === QUARANTINE_PACKAGE_STATUS_IN_STOCK
    ? "openedOnReturnNotice"
    : "openedOnReturnConsumed";
}

/**
 * Audit r3 RAD-4 (BE `StockPackageDetailResponse.returnOwnership`): the carton came back on a return request whose refund is
 * not decided yet (PENDING), or it is the customer's (CUSTOMER_*: held for them, sent back, destroyed on their behalf). The
 * warehouse cannot decide it: release and write-off answer 409 STOCK_PACKAGE_DECISION_PENDING. Before r3 the screen offered
 * both and then explained the 409 as "another decision under way". COMPANY / null decide like any quarantined carton.
 */
export function awaitsReturnDecision(carton: Pick<StockPackageDetail, "returnOwnership">): boolean {
  const ownership = carton.returnOwnership;
  return (
    ownership === RETURN_OWNERSHIP_PENDING || !!ownership?.startsWith(RETURN_OWNERSHIP_CUSTOMER)
  );
}

/**
 * Badge of such a carton: "Chờ duyệt hoàn tiền — RMA-…" while PENDING, "Hàng của khách (giữ hộ) — RMA-…" when it is the
 * customer's; null otherwise.
 */
export function returnOwnershipBadge(
  carton: Pick<StockPackageDetail, "returnOwnership" | "returnRmaNumber">,
): string | null {
  if (!awaitsReturnDecision(carton)) return null;
  return carton.returnOwnership === RETURN_OWNERSHIP_PENDING
    ? QUARANTINE_LABELS.refundPending(carton.returnRmaNumber ?? null)
    : QUARANTINE_LABELS.customerOwned(carton.returnRmaNumber ?? null);
}

/**
 * Docs 20 §4.8, BR-21: only the warehouse manager quarantines / releases (`inventory-stock-packages:UPDATE`),
 * and only a carton that is still `In Stock`. A carton opened on return is never released (write-off only).
 * UI-only — StockPackageController re-checks all of it.
 */
export function allowedQuarantineActions(
  carton: StockPackageDetail,
  can: (code: PermissionCode) => boolean,
): QuarantineAction[] {
  if (carton.status !== QUARANTINE_PACKAGE_STATUS_IN_STOCK) return [];
  if (!can(STOCK_PACKAGE_PERMISSIONS.update)) return [];
  if (isQuarantined(carton))
    return isOpenedOnReturn(carton) || awaitsReturnDecision(carton)
      ? []
      : [QUARANTINE_ACTION.RELEASE];
  return isHeldForOrder(carton) ? [] : [QUARANTINE_ACTION.QUARANTINE];
}

// Writing a damaged carton off is an adjustment request (docs 20 §4.3, §4.8 bước 3): floor work, then four eyes.
export function canWriteOffCarton(
  carton: StockPackageDetail,
  can: (code: PermissionCode) => boolean,
): boolean {
  return (
    carton.status === QUARANTINE_PACKAGE_STATUS_IN_STOCK &&
    isQuarantined(carton) &&
    !awaitsReturnDecision(carton) &&
    can(INVENTORY_PERMISSIONS.stockUpdate)
  );
}
