"use client";

import Link from "next/link";
import { useState } from "react";

import { ADMIN_ROUTES, CHAT_CONTEXT_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { Card } from "@/components/shared/Card";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { owedOf } from "../lifecycle";
import { useCustomerOverview } from "../queries";
import { contextStatusLabel } from "../selectors";

import { AttachContextDialog } from "./AttachContextDialog";
import { TransferDetailsDialog } from "./TransferDetailsDialog";

import type { ChatConversation } from "../schemas";

/** Đường dẫn tới chứng từ ngữ cảnh (báo giá / đơn / hợp đồng); kiểu khác chỉ hiện nhãn. */
function contextHref(kind: string, refId: string): string | null {
  if (kind === "QUOTE") return ADMIN_ROUTES.quotes.detail(refId);
  if (kind === "ORDER") return ADMIN_ROUTES.orders.detail(refId);
  return null;
}

/**
 * Panel phải: hồ sơ khách (S16), chứng từ ngữ cảnh + gắn thêm (S13), đợt còn nợ + gửi thẻ chuyển khoản (S18).
 */
export function CustomerPanel({
  conversation,
  canSend,
  canAttach,
}: {
  conversation: ChatConversation;
  canSend: boolean;
  canAttach: boolean;
}) {
  const overview = useCustomerOverview(conversation.customerId);
  const [transfer, setTransfer] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const data = overview.data;
  const owing = data?.installments ?? [];

  return (
    <Card className="space-y-3 text-[0.8125rem]">
      <h2 className="text-ink-primary text-sm font-semibold">Khách hàng</h2>
      {overview.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : overview.isError ? (
        <p className="text-danger">
          Không tải được hồ sơ khách.{" "}
          <button type="button" className="underline" onClick={() => void overview.refetch()}>
            Thử lại
          </button>
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-ink-tertiary">Tên</dt>
          <dd>{data?.name ?? conversation.customerName ?? "—"}</dd>
          <dt className="text-ink-tertiary">Mã</dt>
          <dd className="font-[family-name:var(--font-mono)]">{data?.code ?? "—"}</dd>
          <dt className="text-ink-tertiary">Liên hệ</dt>
          <dd>{[data?.email, data?.phone].filter(Boolean).join(" · ") || "—"}</dd>
        </dl>
      )}
      <div className="space-y-1">
        <h3 className="text-ink-secondary text-xs font-medium">Chứng từ ngữ cảnh</h3>
        {conversation.contexts.length === 0 && (
          <p className="text-ink-tertiary">Không gắn chứng từ.</p>
        )}
        {conversation.contexts.map((context) => {
          const href = contextHref(context.kind, context.refId);
          const label =
            `${CHAT_CONTEXT_LABELS[context.kind] ?? context.kind} ${context.label ?? ""}`.trim();
          return (
            <div key={context.id}>
              {href ? (
                <Link href={href} className="text-accent hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
              {context.status && (
                <span className="text-ink-tertiary">
                  {" "}
                  · {contextStatusLabel(context.kind, context.status)}
                </span>
              )}
            </div>
          );
        })}
        {canAttach && (
          <Button size="sm" variant="outline" disabled={!data} onClick={() => setAttaching(true)}>
            Gắn chứng từ
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-ink-secondary text-xs font-medium">Đợt còn phải thu</h3>
        {owing.length === 0 && <p className="text-ink-tertiary">Không có.</p>}
        {owing.map((item) => (
          <div key={item.id} className={item.overdue ? "text-danger" : undefined}>
            {item.contractNumber ?? item.orderNumber} — đợt {item.seq}:{" "}
            {formatMoney(owedOf(item), item.currency)}
            {item.dueDate && ` · hạn ${formatDate(item.dueDate)}`}
            {item.overdue && " · quá hạn"}
          </div>
        ))}
        {canSend && owing.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setTransfer(true)}>
            Gửi thông tin chuyển khoản
          </Button>
        )}
      </div>
      <TransferDetailsDialog
        conversationId={conversation.id}
        installments={owing}
        open={transfer}
        onOpenChange={setTransfer}
      />
      <AttachContextDialog
        conversation={conversation}
        overview={data}
        open={attaching}
        onOpenChange={setAttaching}
      />
    </Card>
  );
}
