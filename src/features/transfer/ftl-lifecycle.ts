/**
 * Transfer order — phần nguyên chuyến (FTL) của action-gating (SCRUM-287 PR F9, BE PR #164, LP2-8): lệnh nguyên chuyến
 * không xuất kho thủ công (BE 409 `TRANSFER_DISPATCH_BY_LOAD_PLAN`) mà đi qua đóng gói → kế hoạch xe → xe cuối bàn giao.
 * UI-only — Backend phải re-check.
 */

import {
  DELIVERY_MODE,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  TRANSFER_STATUS,
  UI_LABELS,
} from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { TransferAction, TransferGateState } from "./lifecycle";

/** Lệnh đi nguyên chuyến (mặc định của BE). */
export const isFtl = (transfer: Pick<TransferGateState, "deliveryMode">): boolean =>
  transfer.deliveryMode === DELIVERY_MODE.FULL_TRUCKLOAD;

/** Đã đóng gói xong (`packedAt`): sẵn sàng lập kế hoạch xe. */
export const isPacked = (transfer: Pick<TransferGateState, "packedAt">): boolean =>
  !!transfer.packedAt;

/**
 * Lệnh nguyên chuyến đang lấy hàng: nút Xuất kho bị ẩn và thay bằng câu giải thích (BE 409
 * `TRANSFER_DISPATCH_BY_LOAD_PLAN`) — chỉ khi người dùng có quyền xuất kho (nếu không thì không có gì để giải thích).
 */
export function dispatchExplanation(
  transfer: TransferGateState,
  can: (code: PermissionCode) => boolean,
): string | null {
  return transfer.status === TRANSFER_STATUS.PICKING &&
    isFtl(transfer) &&
    can(TRANSFER_PERMISSIONS.update)
    ? UI_LABELS.transfer.deliveryMode.dispatchByLoadPlan
    : null;
}

/** Gợi ý cạnh nút khi lệnh nguyên chuyến đang chờ bước kế tiếp (đóng gói / lập kế hoạch xe). */
export function nextStepHint(transfer: TransferGateState): string | null {
  if (!isFtl(transfer) || transfer.status !== TRANSFER_STATUS.PICKING || transfer.goodsLeftAt)
    return null;
  return isPacked(transfer)
    ? UI_LABELS.transfer.deliveryMode.planVehicleHint
    : UI_LABELS.transfer.deliveryMode.packFirst;
}

/**
 * Hai thao tác của lệnh nguyên chuyến: đóng gói (mở phiên = `fulfillment-packing:UPDATE`, xem = `fulfillment-packages:READ`;
 * lệnh APPROVED được mở — mở phiên bắt đầu lấy hàng) và lập kế hoạch xe (màn lập cần đọc ứng viên `…:READ` và lập `…:CREATE`).
 */
export const FTL_TRANSFER_ACTIONS: readonly TransferAction[] = [
  {
    code: "packTransfer",
    label: UI_LABELS.transfer.action.packTransfer,
    // BE `TransferPackController`: mở phiên = packing:UPDATE, xem phiên = packages:READ; APPROVED được mở (bắt đầu lấy hàng)
    permissions: [FULFILLMENT_PACKING_PERMISSIONS.update, FULFILLMENT_PACKAGE_PERMISSIONS.read],
    fromStatuses: [TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.PICKING],
    tone: "primary",
    when: (transfer) => isFtl(transfer) && !isPacked(transfer),
  },
  {
    code: "planVehicle",
    label: UI_LABELS.transfer.action.planVehicle,
    // Màn lập kế hoạch cần đọc lô ứng viên (READ) và lập (CREATE)
    permissions: [LOAD_PLAN_PERMISSIONS.read, LOAD_PLAN_PERMISSIONS.create],
    fromStatuses: [TRANSFER_STATUS.PICKING],
    tone: "primary",
    when: (transfer) => isFtl(transfer) && isPacked(transfer) && !transfer.goodsLeftAt,
  },
];
