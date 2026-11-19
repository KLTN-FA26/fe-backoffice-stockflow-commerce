"use client";

import { Wallet } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { useCreditProfile } from "@/features/customer/queries";
import { PAYMENT_TERM_LABEL, allowedPaymentTerms } from "@/features/customer/selectors";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/shared/Skeleton";

import type { CreditProfile } from "@/features/customer/types";

function rowsOf(data: CreditProfile) {
  return [
    {
      label: "Được phép",
      value: allowedPaymentTerms(data)
        .map((term) => PAYMENT_TERM_LABEL[term])
        .join(" · "),
    },
    { label: "Mặc định", value: PAYMENT_TERM_LABEL[data.defaultPaymentTerm] },
    ...(data.depositPercent != null
      ? [
          {
            label: "Tỷ lệ cọc",
            value: <span className="tabular-nums">{data.depositPercent}%</span>,
          },
        ]
      : []),
    ...(data.creditLimit != null
      ? [
          {
            label: "Hạn mức công nợ",
            value: (
              <span className="tabular-nums">{formatMoney(data.creditLimit, data.currency)}</span>
            ),
          },
        ]
      : []),
    ...(data.creditTermDays != null
      ? [
          {
            label: "Số ngày nợ",
            value: <span className="tabular-nums">{data.creditTermDays} ngày</span>,
          },
        ]
      : []),
    ...(!data.configured
      ? [{ label: "Ghi chú", value: "Chưa cấu hình — mặc định chỉ trả trước" }]
      : []),
  ];
}

/**
 * Điều khoản thanh toán — CHỈ ĐỌC ở đây. Cấp / sửa công nợ là việc của người duyệt công nợ
 * (`customer-credit-profiles:APPROVE`, BR-02; quyết định B1: Sales không có quyền cấp CREDIT).
 */
export function CreditProfileCard({
  customerId,
  canRead,
}: {
  customerId: string;
  canRead: boolean;
}) {
  const profile = useCreditProfile(customerId, canRead);
  return (
    <DetailSection title="Điều khoản thanh toán" icon={Wallet}>
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Bạn chưa có quyền xem điều khoản thanh toán.
        </p>
      )}
      {canRead && profile.isPending && <Skeleton className="h-16" />}
      {canRead && profile.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          Không tải được điều khoản thanh toán.{" "}
          <button type="button" className="underline" onClick={() => void profile.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {profile.data && (
        <div className="divide-y divide-(--table-line)">
          {rowsOf(profile.data).map((row) => (
            <InfoRow key={row.label} label={row.label}>
              {row.value}
            </InfoRow>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
