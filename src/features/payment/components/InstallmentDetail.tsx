"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedInstallmentActions } from "../lifecycle";
import { useInstallment } from "../queries";
import { INSTALLMENT_COPY } from "./copy";
import { CodeLink, DateCell, MoneyCell, ReceiptStatusDot } from "./primitives";
import { InstallmentInfoCard } from "./InstallmentInfoCard";
import { RecordReceiptDialog } from "./RecordReceiptDialog";

const L = PAYMENT_LABELS.detail;

function InstallmentDetailContent({ id }: { id: string }) {
  const canRead = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useInstallment(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.contractNumber);
  const [recording, setRecording] = useState(false);
  const back = { href: PAYMENT_ROUTES.installments.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={INSTALLMENT_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={INSTALLMENT_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const i = query.data;
  const canRecord = allowedInstallmentActions(i, can).includes("recordReceipt");

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${PAYMENT_LABELS.installments.pageTitle} ${i.contractNumber}`}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={PAYMENT_ROUTES.installments.list}>
            <ArrowLeft className="size-3.5" /> {PAYMENT_LABELS.installments.pageTitle}
          </Link>
        </Button>
        {canRecord && (
          <Button size="sm" onClick={() => setRecording(true)}>
            <ReceiptText className="size-3.5" /> {PAYMENT_LABELS.receipts.createAction}
          </Button>
        )}
      </div>
      <InstallmentInfoCard installment={i} />
      <Card className="space-y-3">
        <h2 className="text-ink-primary text-sm font-semibold">{L.receiptsTitle}</h2>
        {(i.receipts ?? []).length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">{L.noReceipts}</p>
        ) : (
          <ul className="divide-border-default divide-y text-[0.8125rem]">
            {(i.receipts ?? []).map((receipt) => (
              <li
                key={receipt.receiptId}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
              >
                <CodeLink href={PAYMENT_ROUTES.receipts.detail(receipt.receiptId)}>
                  {receipt.reference}
                </CodeLink>
                <DateCell iso={receipt.receivedOn} />
                <MoneyCell amount={receipt.amount} currency={i.currency} />
                <ReceiptStatusDot status={receipt.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <RecordReceiptDialog installment={recording ? i : null} onClose={() => setRecording(false)} />
    </div>
  );
}

/** Chi tiết một đợt thanh toán kèm các phiếu thu đã trả cho nó (kể cả phiếu đã huỷ). */
export function InstallmentDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[PAYMENT_INSTALLMENT_PERMISSIONS.viewPage]}>
      <InstallmentDetailContent id={id} />
    </PermissionBoundary>
  );
}
