"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { DataTable } from "@/components/shared/DataTable";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedInstallmentActions } from "../lifecycle";
import { useOrderInstallments } from "../queries";

import { ORDER_INSTALLMENTS_COPY } from "./copy";
import { buildInstallmentColumns } from "./installment-columns";
import { InfoRow, MoneyCell, OrderPaymentStatusDot } from "./primitives";
import { RecordReceiptDialog } from "./RecordReceiptDialog";

import type { Installment } from "../types";

const O = PAYMENT_LABELS.order;

function OrderInstallmentsContent({ orderId }: { orderId: string }) {
  const canRead = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useOrderInstallments(orderId, canRead);
  useBreadcrumbLabel(orderId, query.data?.orderNumber);
  const [recording, setRecording] = useState<Installment | null>(null);
  const back = { href: PAYMENT_ROUTES.installments.list };
  if (!canRead)
    return (
      <LoadErrorState error={null} kind="no-read" copy={ORDER_INSTALLMENTS_COPY} back={back} />
    );
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={ORDER_INSTALLMENTS_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const order = query.data;
  const columns = buildInstallmentColumns((row) =>
    allowedInstallmentActions(row, can).includes("recordReceipt") ? (
      <Button type="button" size="xs" variant="outline" onClick={() => setRecording(row)}>
        <ReceiptText className="size-3.5" /> {PAYMENT_LABELS.receipts.createAction}
      </Button>
    ) : null,
  ).map((column) => ({ ...column, sortable: false }));

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${O.summary} ${order.orderNumber}`}</h1>
      <Button asChild variant="outline" size="sm">
        <Link href={PAYMENT_ROUTES.installments.list}>
          <ArrowLeft className="size-3.5" /> {PAYMENT_LABELS.installments.pageTitle}
        </Link>
      </Button>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-ink-primary text-sm font-semibold">
            {O.summary} —{" "}
            <Link
              href={ADMIN_ROUTES.orders.detail(order.orderId)}
              className="text-accent hover:underline"
            >
              {order.orderNumber}
            </Link>{" "}
            · {order.contractNumber}
          </h2>
          {order.paymentStatus ? (
            <OrderPaymentStatusDot status={order.paymentStatus} />
          ) : (
            <span className="text-ink-tertiary text-xs">{O.noPaymentStatus}</span>
          )}
        </div>
        <dl className="grid grid-cols-[minmax(180px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
          <InfoRow label={O.total}>
            <MoneyCell amount={order.total} currency={order.currency} />
          </InfoRow>
          <InfoRow label={O.paid}>
            <MoneyCell amount={order.paid} currency={order.currency} />
          </InfoRow>
          <InfoRow label={O.outstanding}>
            <MoneyCell amount={order.outstanding} currency={order.currency} />
          </InfoRow>
          <InfoRow label={O.onSigning}>
            {order.onSigningPaid ? O.onSigningPaid : O.onSigningUnpaid}
          </InfoRow>
          <InfoRow label={O.beforeDeliveryUnpaid}>
            <MoneyCell amount={order.beforeDeliveryUnpaid} currency={order.currency} />
          </InfoRow>
          <InfoRow label={O.dueBeforeHandover}>
            <MoneyCell amount={order.dueBeforeHandover} currency={order.currency} />
          </InfoRow>
        </dl>
        <p className="text-ink-tertiary text-xs">{O.handoverHint}</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-ink-primary text-sm font-semibold">{O.installmentsTitle}</h2>
        <DataTable
          columns={columns}
          data={order.installments}
          rowKey={(row) => row.installmentId}
          pageSize={50}
          caption={`${order.installments.length} ${PAYMENT_LABELS.installments.pageTitle.toLowerCase()}`}
        />
      </Card>
      <RecordReceiptDialog installment={recording} onClose={() => setRecording(null)} />
    </div>
  );
}

/** Các đợt thanh toán của một đơn và tình hình thanh toán / chặn bàn giao (docs 15 §5.2, BR-07, BR-08). */
export function OrderInstallmentsView({ orderId }: { orderId: string }) {
  return (
    <PermissionBoundary permissions={[PAYMENT_INSTALLMENT_PERMISSIONS.viewPage]}>
      <OrderInstallmentsContent orderId={orderId} />
    </PermissionBoundary>
  );
}
