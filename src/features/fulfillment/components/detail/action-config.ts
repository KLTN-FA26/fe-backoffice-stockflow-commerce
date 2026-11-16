import { CheckCircle2, PackageCheck, UserCog } from "lucide-react";

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
  picking: ["assign", "startPicking", "completePicking", "moveToDispatch"],
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

const CONFIRM_CODES = ["startPicking", "completePicking", "moveToDispatch"] as const;
export type ConfirmCode = (typeof CONFIRM_CODES)[number];

export function isConfirmCode(code: FulfillmentActionCode | null): code is ConfirmCode {
  return CONFIRM_CODES.some((candidate) => candidate === code);
}

export const CONFIRM_COPY: Record<ConfirmCode, (code: string) => string> = {
  startPicking: (code) =>
    `Bắt đầu lấy hàng cho task ${code}? Sau khi bắt đầu, task không gán lại được cho người khác.`,
  // Đích DISPATCH: thùng mang về khu xuất hàng, phần kiểm thùng mở (docs 07 §4.2 bước 6); đích STAGING: thùng ở khu
  // chờ xuất, task chuyển Staged. Câu chung cho cả hai, không nói "khu đóng gói" (khu đó đã gộp vào khu xuất hàng).
  completePicking: (code) =>
    `Xác nhận đã lấy đủ thùng của task ${code}? Thao tác không hoàn lại được.`,
  // Docs 07 §4.3 bước 8: trừ tồn các thùng ở khu chờ xuất, ghi sổ PICK — không hoàn lại được
  moveToDispatch: (code) =>
    `Chuyển cả task ${code} từ khu chờ xuất sang khu xuất hàng? Tồn của mọi thùng trong task sẽ bị trừ và thao tác không hoàn lại được.`,
};

export const ACTION_ICON: Partial<Record<FulfillmentActionCode, typeof CheckCircle2>> = {
  assign: UserCog,
  moveToDispatch: PackageCheck,
};

export const DEFAULT_ACTION_ICON = CheckCircle2;
