"use client";

import { LoaderCircle, Mail, Send } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { useResendInvitation } from "@/features/customer/mutations";
import { usePortalInvitation } from "@/features/customer/queries";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
  InfoRow,
} from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

const STATE_LABEL = {
  PENDING: "Đang chờ khách kích hoạt",
  EXPIRED: "Lời mời đã hết hạn",
  ACTIVATED: "Đã kích hoạt",
  NO_ACCOUNT: "Không có tài khoản portal",
  UNAVAILABLE: "Lời mời hiện không khả dụng",
} as const;

const DELIVERY_LABEL = { SENT: "Đã gửi email", FAILED: "Gửi email thất bại" } as const;

/**
 * Lời mời portal (thẻ cột phải) — trạng thái thật từ BE; nút gửi lại chỉ khi khách còn chờ kích hoạt.
 */
export function InvitationCard({
  customerId,
  canRead,
  canResend,
}: {
  customerId: string;
  /** BE yêu cầu quyền đọc khách và tài khoản back-office. */
  canRead: boolean;
  canResend: boolean;
}) {
  const invitation = usePortalInvitation(customerId, canRead);
  const resend = useResendInvitation();
  const data = invitation.data;
  const rows = data
    ? [
        { label: "Trạng thái", value: STATE_LABEL[data.state] },
        ...(data.delivery ? [{ label: "Email", value: DELIVERY_LABEL[data.delivery] }] : []),
        ...(data.issuedAt ? [{ label: "Gửi lúc", value: formatDateTime(data.issuedAt) }] : []),
        ...(data.expiresAt ? [{ label: "Hết hạn", value: formatDateTime(data.expiresAt) }] : []),
      ]
    : [];

  return (
    <section className={`${DETAIL_CARD_CLASS} space-y-3`}>
      <DetailCardTitle icon={Mail}>Tài khoản portal</DetailCardTitle>
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Bạn không có quyền xem trạng thái lời mời.
        </p>
      )}
      {canRead && invitation.isPending && <Skeleton className="h-16" />}
      {canRead && invitation.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          Không tải được trạng thái lời mời.{" "}
          <button type="button" className="underline" onClick={() => void invitation.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {data && (
        <div className="divide-y divide-(--table-line)">
          {rows.map((row) => (
            <InfoRow key={row.label} label={row.label}>
              {row.value}
            </InfoRow>
          ))}
        </div>
      )}
      {data?.delivery === "FAILED" && (
        <Notice tone="warning">
          Email chưa tới được khách. Kiểm tra lại địa chỉ email rồi gửi lại lời mời.
        </Notice>
      )}
      {canResend && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resend.isPending}
          onClick={() => resend.mutate(customerId)}
          className={DETAIL_ACTION_CLASS.outline}
        >
          {resend.isPending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-3.5" aria-hidden="true" />
          )}
          Gửi lại lời mời
        </Button>
      )}
    </section>
  );
}
