"use client";

import { formatMoney } from "@/lib/format/money";
import { useCreditProfile } from "@/features/customer/queries";
import { Card } from "@/components/shared/Card";
import { Skeleton } from "@/components/shared/Skeleton";

import { InfoList } from "./InfoList";

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
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Hạn mức & kỳ hạn công nợ</h2>
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
      {profile.data && <InfoList items={rowsOf(profile.data)} />}
    </Card>
  );
}
