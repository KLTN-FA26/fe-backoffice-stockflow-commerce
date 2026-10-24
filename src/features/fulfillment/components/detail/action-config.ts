import { CheckCircle2, ShieldCheck, UserCog } from "lucide-react";

import type { FulfillmentActionCode } from "@/features/fulfillment/lifecycle";
import type { FulfillmentScope } from "../primitives";

/** Nhóm thao tác của từng màn — cùng một bảng `FULFILLMENT_ACTIONS`, không rải if/else. */
export const SCOPE_ACTIONS: Record<FulfillmentScope, readonly FulfillmentActionCode[]> = {
  picking: ["assign", "startPicking", "completePicking"],
  packing: ["reverify"],
};

const CONFIRM_CODES = ["startPicking", "completePicking"] as const;
export type ConfirmCode = (typeof CONFIRM_CODES)[number];

export function isConfirmCode(code: FulfillmentActionCode | null): code is ConfirmCode {
  return CONFIRM_CODES.some((candidate) => candidate === code);
}

export const CONFIRM_COPY: Record<ConfirmCode, (code: string) => string> = {
  startPicking: (code) =>
    `Bắt đầu lấy hàng cho task ${code}? Sau khi bắt đầu, task không gán lại được cho người khác.`,
  completePicking: (code) =>
    `Xác nhận đã lấy đủ hàng của task ${code} và mang về khu đóng gói? Thao tác không hoàn lại được.`,
};

export const ACTION_ICON: Partial<Record<FulfillmentActionCode, typeof CheckCircle2>> = {
  assign: UserCog,
  reverify: ShieldCheck,
};

export const DEFAULT_ACTION_ICON = CheckCircle2;
