/**
 * Thẻ thiếu thùng — việc nào hiện cho Sale ở trạng thái nào (docs 17 §4.14 bước 55–60, §5.6, BR-33). Hàm thuần: nhận
 * thẻ + quyền, trả mô tả việc. UI-only — Backend phải re-check (BR-33: quyền của thao tác mà từng hướng chạy; thẻ phải
 * `ANSWERED`, đơn còn treo, phiên bản khớp).
 *
 * Trạng thái → việc: `SENT` chỉ chờ khách (Sale nhắc trong chat, hoặc gửi thẻ mới thay); `ANSWERED` → "Thực hiện" đúng
 * hướng khách chọn; `EXECUTED` / `SUPERSEDED` / `EXPIRED` là cuối (không nút nào). Riêng "giao một phần rồi đóng phần còn
 * lại" có hai bước: bước 1 đặt `executionStarted`, kho kiểm thùng một phần xong (đơn `Partially Fulfilled`) thì Sale đóng.
 */

import { CHAT_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { isLiveShortageCard } from "@/lib/domain/shortage-card";

import type { PermissionCode } from "@/lib/auth";
import type { ShortageOption } from "@/constants";
import type { ShortageCard } from "@/lib/domain/shortage-card";
import type { ShortagePreview } from "./shortage-card-schemas";
import type { OrderReadStatus } from "./types";

type Can = (code: PermissionCode) => boolean;

/**
 * Quyền của thao tác mà từng hướng chạy (BE `ShortageCardController`). "Giảm số thùng" (BE-3 #513): cần cả gỡ treo và huỷ/đóng đơn. Dời cửa sổ cần thêm `sales-contracts:UPDATE` (kiểm riêng trong hộp thoại).
 */
const OPTION_PERMISSIONS: Record<ShortageOption, readonly PermissionCode[]> = {
  WAIT_FOR_PRODUCTION: [ORDER_PERMISSIONS.hold],
  REDUCE_CARTONS: [ORDER_PERMISSIONS.hold, ORDER_PERMISSIONS.cancel],
  SHIP_PART_CLOSE_REST: [ORDER_PERMISSIONS.partialShipment, ORDER_PERMISSIONS.hold],
  CANCEL_ORDER: [ORDER_PERMISSIONS.cancel],
};

export const canExecuteShortageOption = (option: ShortageOption, can: Can): boolean =>
  OPTION_PERMISSIONS[option].every(can);

export const canSendShortageCard = (can: Can): boolean =>
  can(CHAT_PERMISSIONS.update) && can(ORDER_PERMISSIONS.read);

/** Thẻ đang sống của đơn (xem trước) — `live` của BE, hoặc thẻ sống trong lịch sử. */
export function liveShortageCard(preview: ShortagePreview): ShortageCard | null {
  return (
    preview.live?.card ??
    preview.history.map((h) => h.card).find((c) => isLiveShortageCard(c.status)) ??
    null
  );
}

/** Khối "Thiếu thùng" có gì để hiện: gửi được thẻ, hoặc đã có thẻ. Không thì ẩn cả khối. */
export const hasShortageContent = (preview: ShortagePreview): boolean =>
  preview.sendable || preview.live != null || preview.history.length > 0;

export type ShortageNextStep =
  | { kind: "wait-customer" }
  | { kind: "execute"; option: ShortageOption; allowed: boolean }
  | { kind: "await-partial-check" }
  | { kind: "close-rest"; allowed: boolean }
  | { kind: "none" };

/** Việc tiếp theo của Sale trên thẻ sống. */
export function shortageNextStep(
  card: ShortageCard | null,
  orderStatus: OrderReadStatus,
  can: Can,
): ShortageNextStep {
  if (!card || !isLiveShortageCard(card.status)) return { kind: "none" };
  if (card.status === "SENT" || !card.chosen) return { kind: "wait-customer" };
  const option = card.chosen.option;
  if (option === "SHIP_PART_CLOSE_REST" && card.executionStarted) {
    return orderStatus === "Partially Fulfilled"
      ? { kind: "close-rest", allowed: can(ORDER_PERMISSIONS.cancel) }
      : { kind: "await-partial-check" };
  }
  return { kind: "execute", option, allowed: canExecuteShortageOption(option, can) };
}
