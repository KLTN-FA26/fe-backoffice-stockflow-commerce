"use client";

import { Building2 } from "lucide-react";

import { CUSTOMER_STATUS_BY_API } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import type { Customer } from "@/features/customer/types";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/** "Thông tin chung" — trang chi tiết không có tiêu đề, nên tên khách là dòng đầu của mục này. */
export function CustomerGeneralSection({ customer }: { customer: Customer }) {
  return (
    <DetailSection title="Thông tin chung" icon={Building2}>
      <div className="divide-y divide-(--table-line)">
        <InfoRow label="Tên khách hàng">
          <span className="font-medium">{customer.fullName}</span>
        </InfoRow>
        <InfoRow label="Email">
          <span className="break-all">{customer.email}</span>
        </InfoRow>
        <InfoRow label="Điện thoại">
          <span className={MONO}>{customer.phone ?? "—"}</span>
        </InfoRow>
        <InfoRow label="Mã số thuế">
          {customer.taxCode ? <span className={MONO}>{customer.taxCode}</span> : "Chưa có"}
        </InfoRow>
        <InfoRow label="Trạng thái">
          <StatusDot domain="customer" status={CUSTOMER_STATUS_BY_API[customer.status]} size="sm" />
        </InfoRow>
        <InfoRow label="Ngày tạo">
          <span className="tabular-nums">{formatDateTime(customer.createdAt)}</span>
        </InfoRow>
      </div>
    </DetailSection>
  );
}
