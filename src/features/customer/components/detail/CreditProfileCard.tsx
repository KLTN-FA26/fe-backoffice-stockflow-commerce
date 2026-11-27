"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { CREDIT_REQUEST_PERMISSIONS, CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { useCan } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format/money";
import { useCreditProfile } from "@/features/customer/queries";
import { DETAIL_ACTION_CLASS, DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { CreditProfileDialog } from "./CreditProfileDialog";

import type { CreditProfile } from "@/features/customer/types";

/** Neo của thẻ — đơn bị giữ vì công nợ dẫn tới `?creditProfile=edit#credit-profile`. */
const CREDIT_PROFILE_ANCHOR = "credit-profile";
const APPROVED_BY_LABEL = "Người duyệt";

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
    // #286: ai duyệt hạn mức — BE kèm tên; vắng thì không hiện dòng
    ...(data.approvedByName ? [{ label: APPROVED_BY_LABEL, value: data.approvedByName }] : []),
    ...(data.note ? [{ label: "Ghi chú", value: data.note }] : []),
    ...(!data.configured ? [{ label: "Ghi chú", value: "Chưa cấu hình hạn mức công nợ" }] : []),
  ];
}

/**
 * Hạn mức & kỳ hạn công nợ (docs 18 §2). Cấp / sửa chỉ cho người duyệt công nợ (`customer-credit-profiles:APPROVE`,
 * BR-02; quyết định B1: Sales không cấp CREDIT; AUTH-6: Kế toán). Hộp thoại mở theo URL `?creditProfile=edit`
 * (state-persistence): nút ở đây và lối tắt từ đơn bị giữ vì công nợ cùng một đường.
 */
export function CreditProfileCard({
  customerId,
  canRead,
  canApprove,
}: {
  customerId: string;
  canRead: boolean;
  canApprove: boolean;
}) {
  // Sửa cần bản hiện tại (`expectedVersion`) — BE GET cần READ, nên nút sửa chỉ hiện khi đã đọc được hồ sơ.
  // UI-only, Backend phải re-check (PUT cần APPROVE).
  const profile = useCreditProfile(customerId, canRead);
  const [mode, setMode] = useQueryState("creditProfile", parseAsStringLiteral(["edit"] as const));
  // Chỉ nhận đường dẫn trong back-office (không mở chuyển hướng ra ngoài).
  const [returnParam] = useQueryState("creditReturnTo", parseAsString);
  const returnTo = returnParam && /^\/admin\/[^/]/.test(returnParam) ? returnParam : null;
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${CREDIT_PROFILE_ANCHOR}`) anchor.current?.scrollIntoView();
  }, []);

  // A2 (BE PR #490): Sale không sửa hạn mức trực tiếp mà gửi đề nghị thay khách cho Kế toán duyệt. Form tạo nằm ở
  // trang đề nghị (`?create=<customerId>`) — không import feature khác. UI-only, Backend re-check (CREATE).
  const canRequest = useCan(CREDIT_REQUEST_PERMISSIONS.create);
  const data = profile.data;
  const request = canRequest ? (
    <Button asChild variant="outline" size="sm" className={DETAIL_ACTION_CLASS.outline}>
      <Link href={CREDIT_REQUEST_ROUTES.createFor(customerId)}>Đề nghị cấp hạn mức</Link>
    </Button>
  ) : null;
  const editButton =
    canApprove && data ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={DETAIL_ACTION_CLASS.outline}
        onClick={() => void setMode("edit")}
      >
        {data.configured ? "Sửa hạn mức" : "Cấp hạn mức công nợ"}
      </Button>
    ) : null;
  const edit =
    request || editButton ? (
      <>
        {request}
        {editButton}
      </>
    ) : undefined;

  return (
    <div id={CREDIT_PROFILE_ANCHOR} ref={anchor} className="scroll-mt-20">
      <DetailSection title="Hạn mức & kỳ hạn công nợ" icon={Wallet} actions={edit}>
        {returnTo && (
          <Notice tone="info" className="mb-3">
            Bạn đến từ đơn bị giữ vì công nợ.{" "}
            <Link href={returnTo} className="text-accent-text font-medium hover:underline">
              Quay lại
            </Link>
          </Notice>
        )}
        {!canRead && (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Bạn chưa có quyền xem hạn mức công nợ.
          </p>
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
        {data && (
          <div className="divide-y divide-(--table-line)">
            {rowsOf(data).map((row, index) => (
              <InfoRow key={`${row.label}-${index}`} label={row.label}>
                {row.value}
              </InfoRow>
            ))}
          </div>
        )}
      </DetailSection>
      <CreditProfileDialog
        customerId={customerId}
        profile={data}
        open={canApprove && mode === "edit"}
        onOpenChange={(open) => void setMode(open ? "edit" : null)}
      />
    </div>
  );
}
