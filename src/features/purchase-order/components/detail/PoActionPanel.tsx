"use client";

import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  PackageX,
  RotateCcw,
  Send,
  Undo2,
  XCircle,
} from "lucide-react";

import { PO_STATUS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { isPoTerminal } from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { LucideIcon } from "lucide-react";
import type { PoAction, PoActionCode, PoStatus } from "@/features/purchase-order";

const label = (status: PoStatus) => STATUS_LABEL_VI[status] ?? status;

/** Cùng kiểu nút với trang chi tiết NCC (`supplier-detail/SidebarCards.tsx`). */
const BUTTON_BASE = "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";
// `dark:` lặp lại nền vì variant outline của shadcn có `dark:bg-input/30` đè nền ở dark mode.
const STYLE_OF = {
  primary:
    "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
  secondary:
    "border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted dark:bg-bg-surface",
  danger:
    "border-danger text-danger hover:bg-danger/10 hover:text-danger bg-transparent dark:bg-transparent",
} as const;

const ACTION_ICON: Record<PoActionCode, LucideIcon> = {
  submit: FileCheck2,
  approve: CheckCircle2,
  reject: Undo2,
  send: Send,
  close: Archive,
  recordConfirmation: ClipboardCheck,
  recoverDelivery: RotateCcw,
  closeShort: PackageX,
  cancel: XCircle,
};

/** Thao tác chính của luồng = nền brand; thao tác phụ = viền trung tính; phá huỷ = viền đỏ. */
function styleOf(act: PoAction): keyof typeof STYLE_OF {
  if (act.destructive) return "danger";
  return act.code === "recordConfirmation" || act.code === "recoverDelivery"
    ? "secondary"
    : "primary";
}

export function PoActionPanel({
  status,
  actions,
  isMutating,
  conflictError,
  onAction,
}: {
  status: PoStatus;
  actions: readonly PoAction[];
  isMutating: boolean;
  conflictError: string | null;
  onAction: (act: PoAction) => void;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="po" status={status} size="md" withIcon />
      </div>
      {conflictError && (
        <div role="alert" className="mb-2">
          <Alert tone="danger">{conflictError}</Alert>
        </div>
      )}
      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((act) => {
            const Icon = ACTION_ICON[act.code];
            return (
              <Button
                key={act.code}
                type="button"
                variant={act.destructive ? "outline" : "default"}
                size="sm"
                disabled={isMutating}
                onClick={() => onAction(act)}
                className={`${STYLE_OF[styleOf(act)]} ${BUTTON_BASE}`}
              >
                <Icon className="size-3.5" /> {act.label}
              </Button>
            );
          })}
        </div>
      )}
      {/* Chỉ báo "không có hành động" khi thật sự không còn nút nào: PO đã đóng vẫn có thể
          còn "Ghi nhận NCC phản hồi" (BE cho ghi nhận phản hồi muộn khi đang chờ NCC). */}
      {isPoTerminal(status) && actions.length === 0 && (
        <p className="text-ink-tertiary text-center text-xs">
          Trạng thái kết thúc — không có hành động khả dụng.
        </p>
      )}
    </section>
  );
}

/** Mô tả dialog xác nhận — nhãn tiếng Việt, không hiện mã enum thô. */
export function actionDescription(act: PoAction, current: PoStatus): string {
  if (act.code === "submit") {
    return `Gửi duyệt — đơn chuyển sang "${label(PO_STATUS.PENDING_APPROVAL)}" và được chụp lại nội dung. Người duyệt phải là người khác.`;
  }
  if (act.code === "approve") {
    return `Phê duyệt đơn — chuyển từ "${label(current)}" sang "${label(PO_STATUS.APPROVED)}". Sau khi duyệt mới xác nhận & gửi được NCC. Không duyệt được đơn do chính mình gửi.`;
  }
  if (act.code === "reject") {
    return `Từ chối duyệt — đơn trở về "${label(PO_STATUS.DRAFT)}" để sửa rồi gửi duyệt lại.`;
  }
  if (act.code === "close") {
    return `Đóng đơn — đã nhận đủ hàng, đơn chuyển sang "${label(PO_STATUS.CLOSED)}".`;
  }
  if (act.code === "cancel") {
    return `Huỷ đơn — chuyển từ "${label(current)}" sang "${label(PO_STATUS.CANCELLED)}". Không thể khôi phục.`;
  }
  if (act.code === "closeShort") {
    return `Đóng thiếu — đơn chuyển sang "${label(PO_STATUS.CLOSED)}", phần chưa nhận được ghi nhận thiếu.`;
  }
  return `Xác nhận "${act.label}".`;
}
