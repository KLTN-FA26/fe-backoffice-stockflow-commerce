"use client";

import { useState } from "react";
import { Lock, LockOpen, RotateCcw, UserX } from "lucide-react";

import { useChangeCustomerStatus } from "@/features/customer/mutations";
import { CUSTOMER_ACTION_TARGET, REASON_REQUIRED } from "@/features/customer/lifecycle";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ActionTrigger } from "@/components/shared/ObjectActions";

import type { LucideIcon } from "lucide-react";
import type { CustomerStatusAction } from "@/features/customer/lifecycle";
import type { Customer } from "@/features/customer/types";

const COPY: Record<
  CustomerStatusAction,
  { label: string; title: string; description: string; danger: boolean }
> = {
  suspend: {
    label: "Tạm khoá",
    title: "Tạm khoá khách hàng?",
    description:
      "Khách không đăng nhập / đặt hàng được; mọi phiên đang mở bị thu hồi. Đơn đang chạy vẫn xử lý tiếp.",
    danger: true,
  },
  reactivate: {
    label: "Mở khoá",
    title: "Mở khoá khách hàng?",
    description: "Khách đăng nhập lại bằng mật khẩu cũ; các phiên cũ vẫn đã kết thúc.",
    danger: false,
  },
  close: {
    label: "Đóng tài khoản",
    title: "Đóng tài khoản khách?",
    description: "Khách không đăng nhập / đặt hàng mới được. Có thể mở lại sau với lý do.",
    danger: true,
  },
  reopen: {
    label: "Mở lại tài khoản",
    title: "Mở lại tài khoản đã đóng?",
    description:
      "Bắt buộc ghi lý do. Nếu người liên hệ chưa từng kích hoạt, khách quay về trạng thái chờ kích hoạt.",
    danger: false,
  },
};

const ICON: Record<CustomerStatusAction, LucideIcon> = {
  suspend: Lock,
  reactivate: LockOpen,
  close: UserX,
  reopen: RotateCcw,
};

/** Bước phá huỷ (tạm khoá / đóng) — chữ đỏ trong menu "⋯". */
export const isDangerCustomerAction = (action: CustomerStatusAction) => COPY[action].danger;

/**
 * Một thao tác đổi trạng thái (bước bảng vòng đời cho phép — lifecycle.ts): nút / mục menu qua `ActionTrigger` (đổi dáng
 * theo chỗ đặt trên header đối tượng) + `ConfirmDialog` của nó. UI-only — Backend phải re-check.
 */
export function CustomerStatusAction({
  customer,
  action,
}: {
  customer: Customer;
  action: CustomerStatusAction;
}) {
  const [open, setOpen] = useState(false);
  const change = useChangeCustomerStatus();
  const copy = COPY[action];
  return (
    <>
      <ActionTrigger
        icon={ICON[action]}
        label={copy.label}
        danger={copy.danger}
        onClick={() => setOpen(true)}
      />
      {open && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.label}
          variant={copy.danger ? "danger" : "default"}
          requireReason={REASON_REQUIRED.has(action)}
          reasonLabel="Lý do"
          reasonMaxLength={1000}
          loading={change.isPending}
          closeOnConfirm={false}
          onConfirm={(reason) =>
            change.mutate(
              { id: customer.customerId, status: CUSTOMER_ACTION_TARGET[action], reason },
              { onSuccess: () => setOpen(false) },
            )
          }
        />
      )}
    </>
  );
}
