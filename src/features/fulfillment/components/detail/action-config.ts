import { ArrowRightLeft, CheckCircle2, PackageCheck, PackagePlus, UserCog } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { allowedTaskActions } from "@/features/fulfillment/pick-line-lifecycle";

import type {
  FulfillmentAction,
  FulfillmentActionCode,
  FulfillmentActor,
  FulfillmentGateState,
} from "@/features/fulfillment/lifecycle";
import type { FulfillmentScope } from "../primitives";

/** Nhóm thao tác của từng màn — cùng một bảng `FULFILLMENT_ACTIONS`, không rải if/else. */
export const SCOPE_ACTIONS: Record<FulfillmentScope, readonly FulfillmentActionCode[]> = {
  picking: [
    "assign",
    "changeDestination",
    "startPicking",
    "completePicking",
    "moveToDispatch",
    "topUp",
  ],
  packing: [],
};

/**
 * Thao tác của task trong một màn: theo trạng thái + mã quyền + người được gán, và "Hoàn tất lấy hàng" chỉ khi
 * mọi dòng đã PICKED / STAGED / CANCELLED (BE `requireAllPicked`). Màn đóng gói không có dòng lấy hàng → `true`.
 */
export function scopeActions(
  task: FulfillmentGateState,
  actor: FulfillmentActor,
  scope: FulfillmentScope,
  linesComplete: boolean,
): readonly FulfillmentAction[] {
  return allowedTaskActions(task, actor, { linesComplete }).filter((action) =>
    SCOPE_ACTIONS[scope].includes(action.code),
  );
}

/**
 * Thao tác có hộp xác nhận: hoàn tất / chuyển khu / lấy bổ sung (không hoàn lại được). "Bắt đầu lấy hàng" là thao tác thường
 * → bấm một lần là bắt đầu, không hỏi lại (S14-8).
 */
const CONFIRM_CODES = ["completePicking", "moveToDispatch", "topUp"] as const;
export type ConfirmCode = (typeof CONFIRM_CODES)[number];

export function isConfirmCode(code: FulfillmentActionCode | null): code is ConfirmCode {
  return CONFIRM_CODES.some((candidate) => candidate === code);
}

/** Thao tác phụ của task Pending (mở dialog, không đổi trạng thái): gán lại, đổi đích. */
export function isSecondaryCode(code: FulfillmentActionCode): boolean {
  return code === "assign" || code === "changeDestination";
}

/** Câu hỏi xác nhận từng thao tác (chữ ở `UI_LABELS.fulfillment.confirm`). Docs 07 §4.2 bước 6 (đích DISPATCH / STAGING), §4.3 bước 7–8. */
export const CONFIRM_COPY: Record<ConfirmCode, (code: string) => string> = {
  completePicking: UI_LABELS.fulfillment.confirm.completePicking,
  moveToDispatch: UI_LABELS.fulfillment.confirm.moveToDispatch,
  topUp: UI_LABELS.fulfillment.confirm.topUp,
};

export const ACTION_ICON: Partial<Record<FulfillmentActionCode, typeof CheckCircle2>> = {
  assign: UserCog,
  changeDestination: ArrowRightLeft,
  moveToDispatch: PackageCheck,
  topUp: PackagePlus,
};

export const DEFAULT_ACTION_ICON = CheckCircle2;
