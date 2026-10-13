"use client";

import { useState } from "react";

import { useChangeCustomerStatus } from "@/features/customer/mutations";
import {
  CUSTOMER_ACTION_TARGET,
  REASON_REQUIRED,
  allowedCustomerActions,
} from "@/features/customer/lifecycle";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

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

/** Thao tác đổi trạng thái — chỉ hiện các bước bảng vòng đời cho phép (lifecycle.ts). */
export function CustomerStatusActions({
  customer,
  canChangeStatus,
}: {
  customer: Customer;
  canChangeStatus: boolean;
}) {
  const [pending, setPending] = useState<CustomerStatusAction | null>(null);
  const change = useChangeCustomerStatus();
  const actions = allowedCustomerActions(customer.status, canChangeStatus);
  if (actions.length === 0) return null;
  const copy = pending ? COPY[pending] : null;

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant="outline"
          className={COPY[action].danger ? "text-danger" : undefined}
          onClick={() => setPending(action)}
        >
          {COPY[action].label}
        </Button>
      ))}
      {pending && copy && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.label}
          variant={copy.danger ? "danger" : "default"}
          requireReason={REASON_REQUIRED.has(pending)}
          reasonLabel="Lý do"
          reasonMaxLength={1000}
          loading={change.isPending}
          closeOnConfirm={false}
          onConfirm={(reason) =>
            change.mutate(
              { id: customer.customerId, status: CUSTOMER_ACTION_TARGET[pending], reason },
              { onSuccess: () => setPending(null) },
            )
          }
        />
      )}
    </>
  );
}
