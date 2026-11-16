"use client";

import { useState } from "react";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { einvoiceErrorMessage } from "../errors";
import { useSendErrorNotice } from "../mutations";
import { useErrorNotices } from "../queries";

import type { ErrorNotice } from "../types";

const STATUS: Record<ErrorNotice["status"], string> = {
  DRAFT: "Chưa gửi",
  SENT: "Đã gửi, chờ cơ quan thuế",
  ACCEPTED: "Cơ quan thuế chấp nhận",
  REJECTED: "Cơ quan thuế từ chối",
};

/**
 * Thông báo sai sót của hoá đơn, cũ nhất trước, kèm phản hồi của cơ quan thuế. Thông báo chưa gửi /
 * đang chờ có nút gửi lại hoặc hỏi kết quả (BE `/error-notices/{id}/sending`).
 */
export function ErrorNoticesCard({ id }: { id: string }) {
  const query = useErrorNotices(id);
  const canSend = useCan(EINVOICE_PERMISSIONS.approve);
  const send = useSendErrorNotice();
  const [error, setError] = useState<string | null>(null);
  const notices = query.data ?? [];
  if (!query.isPending && notices.length === 0) return null;

  return (
    <Card className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">
        {EINVOICE_LABELS.detail.errorNotices}
      </h2>
      <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
        {notices.map((notice) => (
          <li key={notice.id} className="space-y-1 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-mono">{notice.formCode}</span>
              <span className="text-ink-secondary tabular-nums">
                {formatDateTime(notice.recordedAt)}
              </span>
              <span className="font-medium">{STATUS[notice.status]}</span>
              {canSend && (notice.status === "DRAFT" || notice.status === "SENT") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={send.isPending}
                  onClick={() =>
                    send.mutate(
                      { id, noticeId: notice.id },
                      { onError: (failure) => setError(einvoiceErrorMessage(failure)) },
                    )
                  }
                >
                  {notice.status === "DRAFT" ? "Gửi lại" : "Hỏi kết quả"}
                </Button>
              )}
            </div>
            <p className="text-ink-primary">{notice.reason}</p>
            {(notice.correctBuyerName || notice.correctBuyerAddress) && (
              <p className="text-ink-secondary">
                Đúng là:{" "}
                {[notice.correctBuyerName, notice.correctBuyerAddress].filter(Boolean).join(" — ")}
              </p>
            )}
            {notice.responseMessage && (
              <p className="text-ink-tertiary">
                Phản hồi: {notice.responseMessage}
                {notice.responseCode ? ` (${notice.responseCode})` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {error}
        </p>
      )}
    </Card>
  );
}
