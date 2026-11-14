"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_RECEIPT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedReceiptActions } from "../lifecycle";
import { useReceipt } from "../queries";
import { milestoneLabel } from "../selectors";

import { RECEIPT_COPY } from "./copy";
import { CodeLink, DateCell, InfoRow, MoneyCell, ReceiptStatusDot } from "./primitives";
import { VoidReceiptDialog } from "./VoidReceiptDialog";

const R = PAYMENT_LABELS.receipts;
const C = PAYMENT_LABELS.columns;

function ReceiptDetailContent({ id }: { id: string }) {
  const canRead = useCan(PAYMENT_RECEIPT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useReceipt(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.reference);
  const [voiding, setVoiding] = useState(false);
  const back = { href: PAYMENT_ROUTES.receipts.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={RECEIPT_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={RECEIPT_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const receipt = query.data;
  const canVoid = allowedReceiptActions(receipt, can).includes("voidReceipt");

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${R.pageTitle} ${receipt.reference}`}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={PAYMENT_ROUTES.receipts.list}>
            <ArrowLeft className="size-3.5" /> {R.pageTitle}
          </Link>
        </Button>
        {canVoid && (
          <Button
            size="sm"
            variant="outline"
            className="text-danger"
            onClick={() => setVoiding(true)}
          >
            <Ban className="size-3.5" /> {R.voidAction}
          </Button>
        )}
      </div>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-ink-primary font-mono text-sm font-semibold">{receipt.reference}</h2>
          <ReceiptStatusDot status={receipt.status} />
        </div>
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
          <InfoRow label={C.customer}>
            <CustomerName id={receipt.customerId} />
          </InfoRow>
          <InfoRow label={C.receivedOn}>
            <DateCell iso={receipt.receivedOn} />
          </InfoRow>
          <InfoRow label={R.total}>
            <MoneyCell amount={receipt.amount} currency={receipt.currency} />
          </InfoRow>
          <InfoRow label={C.recordedAt}>{formatDateTime(receipt.recordedAt)}</InfoRow>
          {receipt.note && <InfoRow label={R.note}>{receipt.note}</InfoRow>}
        </dl>
        {receipt.status === "VOIDED" && (
          <div className="border-border-default space-y-1 border-t pt-3 text-[0.8125rem]">
            <h3 className="text-ink-primary font-semibold">{R.voidInfo}</h3>
            {receipt.voidedAt && (
              <p className="text-ink-secondary">
                {R.voidedAt}: {formatDateTime(receipt.voidedAt)}
              </p>
            )}
            {receipt.voidReason && (
              <p className="text-ink-secondary whitespace-pre-line">
                {R.voidReason}: {receipt.voidReason}
              </p>
            )}
          </div>
        )}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-ink-primary text-sm font-semibold">{R.lines}</h2>
        <ul className="divide-border-default divide-y text-[0.8125rem]">
          {receipt.lines.map((line) => (
            <li
              key={line.installmentId}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
            >
              <CodeLink href={PAYMENT_ROUTES.installments.detail(line.installmentId)}>
                {line.contractNumber ?? line.installmentId.slice(0, 8)}
              </CodeLink>
              {line.seq != null && (
                <span>{`Đợt ${line.seq}${line.name ? ` — ${line.name}` : ""}`}</span>
              )}
              {line.milestone && (
                <span className="text-ink-secondary">{milestoneLabel(line.milestone)}</span>
              )}
              {line.orderId && line.orderNumber && (
                <CodeLink href={ADMIN_ROUTES.orders.detail(line.orderId)}>
                  {line.orderNumber}
                </CodeLink>
              )}
              <span className="ml-auto">
                <MoneyCell amount={line.amount} currency={receipt.currency} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <VoidReceiptDialog receipt={voiding ? receipt : null} onClose={() => setVoiding(false)} />
    </div>
  );
}

/** Chi tiết phiếu thu và các đợt nó trả; huỷ phiếu ghi sai tại đây (docs 15 §4.4, BR-04). */
export function ReceiptDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[PAYMENT_RECEIPT_PERMISSIONS.viewPage]}>
      <ReceiptDetailContent id={id} />
    </PermissionBoundary>
  );
}
