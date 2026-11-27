"use client";

import { Pencil } from "lucide-react";

import { CUSTOMER_STATUS_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDateTime } from "@/lib/format/date";
import { LifecycleSteps, ProfileFact, ProfileFrame } from "@/components/shared/ObjectPage";
import { Button } from "@/components/ui/button";

import type { Customer } from "@/features/customer/types";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
const DASH = <span className="text-ink-tertiary font-normal">—</span>;

/** Nhãn trạng thái nguyên văn từ `status-map` (không gõ tay lại). */
const label = (status: Customer["status"]) =>
  STATUS_LABEL_VI[CUSTOMER_STATUS_BY_API[status]] ?? CUSTOMER_STATUS_BY_API[status];

/** Vòng đời khách (lifecycle.ts): chờ kích hoạt → hoạt động; tạm khoá / đã đóng là nhánh rẽ, nối thêm làm bước cuối. */
function steps(status: Customer["status"]): { steps: string[]; current: number } {
  const base = [label("PENDING_ACTIVATION"), label("ACTIVE")];
  if (status === "PENDING_ACTIVATION") return { steps: base, current: 0 };
  if (status === "ACTIVE") return { steps: base, current: 1 };
  return { steps: [...base, label(status)], current: 2 };
}

/**
 * Khung hồ sơ khách (backoffice-erp-ui B11): vòng đời nằm ngang + "Chỉnh sửa" ở đầu khung, dưới là 4 thông số liên hệ.
 * Tên, mã, trạng thái ở header; pháp lý / công nợ / lời mời / lịch sử ở tab.
 */
export function CustomerOverviewPanel({
  customer,
  onEdit,
}: {
  customer: Customer;
  /** Có khi người dùng có quyền sửa (`customer-customers:UPDATE`). */
  onEdit?: () => void;
}) {
  const lifecycle = steps(customer.status);
  return (
    <ProfileFrame
      label="Hồ sơ khách hàng"
      head={
        <LifecycleSteps
          label="Vòng đời khách hàng"
          steps={lifecycle.steps}
          current={lifecycle.current}
        />
      }
      actions={
        onEdit ? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden /> Chỉnh sửa
          </Button>
        ) : undefined
      }
    >
      <ProfileFact label="Email" title={customer.email}>
        {customer.email}
      </ProfileFact>
      <ProfileFact label="Điện thoại">
        {customer.phone ? <span className={MONO}>{customer.phone}</span> : DASH}
      </ProfileFact>
      <ProfileFact label="Mã số thuế">
        {customer.taxCode ? <span className={MONO}>{customer.taxCode}</span> : DASH}
      </ProfileFact>
      <ProfileFact label="Ngày tạo">
        <span className="tabular-nums">{formatDateTime(customer.createdAt)}</span>
      </ProfileFact>
    </ProfileFrame>
  );
}
