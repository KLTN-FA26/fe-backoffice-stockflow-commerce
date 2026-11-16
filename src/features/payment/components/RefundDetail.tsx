"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Undo2 } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_REFUND_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedRefundActions, allowedRefundRecordActions } from "../lifecycle";
import { useOrderRefund } from "../queries";

import { REFUND_COPY } from "./copy";
import { InfoRow, MoneyCell, RefundStateDot } from "./primitives";
import { RecordRefundDialog } from "./RecordRefundDialog";
import { RefundRecords } from "./RefundRecords";
import { RefundSettlements } from "./RefundSettlements";
import { VoidRefundDialog } from "./VoidRefundDialog";

import type { RefundRecord } from "../types";

const L = PAYMENT_LABELS.refunds;

function RefundDetailContent({ orderId }: { orderId: string }) {
  const canRead = useCan(PAYMENT_REFUND_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useOrderRefund(orderId, { enabled: canRead });
  useBreadcrumbLabel(orderId, query.data?.orderNumber);
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<RefundRecord | null>(null);
  const back = { href: PAYMENT_ROUTES.refunds.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={REFUND_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={REFUND_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const refund = query.data;
  const canRecord = allowedRefundActions(refund, can).includes("recordRefund");

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${L.pageTitle} ${refund.orderNumber}`}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={PAYMENT_ROUTES.refunds.list}>
            <ArrowLeft className="size-3.5" /> {L.pageTitle}
          </Link>
        </Button>
        {canRecord && (
          <Button size="sm" onClick={() => setRecording(true)}>
            <Undo2 className="size-3.5" /> {L.recordAction}
          </Button>
        )}
      </div>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-ink-primary text-sm font-semibold">
            {L.summary} —{" "}
            <Link
              href={ADMIN_ROUTES.orders.detail(refund.orderId)}
              className="text-accent hover:underline"
            >
              {refund.orderNumber}
            </Link>
          </h2>
          <RefundStateDot status={refund.refundStatus} />
        </div>
        <dl className="grid grid-cols-[minmax(160px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
          <InfoRow label={L.refundable}>
            <MoneyCell amount={refund.refundable} currency={refund.currency} />
          </InfoRow>
          <InfoRow label={L.refunded}>
            <MoneyCell amount={refund.refunded} currency={refund.currency} />
          </InfoRow>
          <InfoRow label={L.remaining}>
            <MoneyCell amount={refund.remaining} currency={refund.currency} />
          </InfoRow>
        </dl>
        <p className="text-ink-tertiary text-xs">{L.outsideNote}</p>
      </Card>
      {(refund.settlements ?? []).length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-ink-primary text-sm font-semibold">{L.settlements}</h2>
          <RefundSettlements refund={refund} />
        </Card>
      )}
      <RefundRecords
        records={refund.records ?? []}
        canVoid={(record) => allowedRefundRecordActions(record, can).includes("voidRefundRecord")}
        onVoid={setVoiding}
      />
      <RecordRefundDialog refund={recording ? refund : null} onClose={() => setRecording(false)} />
      <VoidRefundDialog record={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

/** Số tiền phải hoàn của một đơn, các lần tính và các lần ghi nhận đã hoàn (docs 15 §4.5, BR-14). */
export function RefundDetail({ orderId }: { orderId: string }) {
  return (
    <PermissionBoundary permissions={[PAYMENT_REFUND_PERMISSIONS.viewPage]}>
      <RefundDetailContent orderId={orderId} />
    </PermissionBoundary>
  );
}
