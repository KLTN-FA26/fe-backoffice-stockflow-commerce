"use client";

import { LoaderCircle, Send } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { useResendInvitation } from "@/features/customer/mutations";
import { usePortalInvitation } from "@/features/customer/queries";
import { Card } from "@/components/shared/Card";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared/Notice";

import { InfoList } from "./InfoList";

const STATE_LABEL = {
  PENDING: "Đang chờ khách kích hoạt",
  EXPIRED: "Lời mời đã hết hạn",
  ACTIVATED: "Đã kích hoạt",
  NO_ACCOUNT: "Không có tài khoản portal",
} as const;

const DELIVERY_LABEL = { SENT: "Đã gửi email", FAILED: "Gửi email thất bại" } as const;

/** Lời mời portal — trạng thái thật từ BE; nút gửi lại chỉ khi khách còn chờ kích hoạt. */
export function InvitationCard({
  customerId,
  canRead,
  canResend,
}: {
  customerId: string;
  /** BE chỉ cho SALES_STAFF / ECOMMERCE_ADMIN xem (role check trong controller). */
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
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">Tài khoản portal</h2>
        {canResend && (
          <Button
            size="sm"
            variant="outline"
            disabled={resend.isPending}
            onClick={() => resend.mutate(customerId)}
          >
            {resend.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
            Gửi lại lời mời
          </Button>
        )}
      </div>
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Chỉ Sales và Quản trị TMĐT xem được trạng thái lời mời.
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
      {data && <InfoList items={rows} />}
      {data?.delivery === "FAILED" && (
        <Notice tone="warning">
          Email chưa tới được khách. Kiểm tra lại địa chỉ email rồi gửi lại lời mời.
        </Notice>
      )}
    </Card>
  );
}
