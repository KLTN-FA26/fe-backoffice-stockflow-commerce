"use client";

import { Wallet } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { useCreditProfile } from "@/features/customer/queries";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/shared/Skeleton";

import type { CreditProfile } from "@/features/customer/types";

function rowsOf(data: CreditProfile) {
  return [
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
            label: "Kỳ hạn công nợ",
            value: <span className="tabular-nums">{data.creditTermDays} ngày</span>,
          },
        ]
      : []),
    ...(!data.configured ? [{ label: "Ghi chú", value: "Chưa cấu hình hạn mức công nợ" }] : []),
  ];
}

/**
 * Hạn mức & kỳ hạn công nợ (docs 18 §2) — CHỈ ĐỌC ở đây. Cấp / sửa công nợ là việc của người duyệt công nợ
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
    <DetailSection title="Hạn mức & kỳ hạn công nợ" icon={Wallet}>
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">Bạn chưa có quyền xem hạn mức công nợ.</p>
      )}
      {canRead && profile.isPending && <Skeleton className="h-16" />}
      {canRead && profile.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          Không tải được hạn mức công nợ.{" "}
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
