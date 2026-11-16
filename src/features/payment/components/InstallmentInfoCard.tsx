"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { formatDateTime } from "@/lib/format/date";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { Card } from "@/components/shared/Card";

import {
  blocksHandover,
  deliveryBatchLabel,
  displayStatus,
  installmentTitle,
  milestoneLabel,
} from "../selectors";

import { CodeLink, DateCell, InfoRow, InstallmentStatusDot, MoneyCell } from "./primitives";

import type { Installment } from "../types";

const L = PAYMENT_LABELS.detail;
const C = PAYMENT_LABELS.columns;
const EMPTY = PAYMENT_LABELS.empty;

/** Thông tin một đợt thanh toán: mốc, đợt giao gắn kèm, tiền, hạn trả, nội dung chuyển khoản (docs 15 §4.1, §5.1). */
export function InstallmentInfoCard({ installment: i }: { installment: Installment }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">{installmentTitle(i)}</h2>
        <InstallmentStatusDot status={displayStatus(i)} />
      </div>
      <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
        <InfoRow label={C.contract}>{i.contractNumber}</InfoRow>
        <InfoRow label={C.order}>
          <CodeLink href={ADMIN_ROUTES.orders.detail(i.orderId)}>{i.orderNumber}</CodeLink>
        </InfoRow>
        <InfoRow label={C.customer}>
          <CustomerName id={i.customerId} />
        </InfoRow>
        <InfoRow label={C.milestone}>{milestoneLabel(i.milestone)}</InfoRow>
        <InfoRow label={C.deliveryBatch}>
          {deliveryBatchLabel(i)}
          {blocksHandover(i) && (
            <span className="text-warning ml-2 text-xs">
              {PAYMENT_LABELS.installments.handoverBlocked}
            </span>
          )}
        </InfoRow>
        <InfoRow label={C.amount}>
          <MoneyCell amount={i.amount} currency={i.currency} />
        </InfoRow>
        {i.reducedAmount > 0 && (
          <InfoRow label={C.reduced}>
            <MoneyCell amount={i.reducedAmount} currency={i.currency} />
          </InfoRow>
        )}
        <InfoRow label={C.paid}>
          <MoneyCell amount={i.paidAmount} currency={i.currency} />
        </InfoRow>
        <InfoRow label={C.outstanding}>
          <MoneyCell amount={i.outstanding} currency={i.currency} />
        </InfoRow>
        <InfoRow label={C.dueDate}>
          {i.dueDate ? <DateCell iso={i.dueDate} /> : PAYMENT_LABELS.installments.noDueDate}
        </InfoRow>
        {i.dueDays != null && <InfoRow label={L.dueDays}>{i.dueDays}</InfoRow>}
        <InfoRow label={L.transferReference}>
          <span className="font-mono">{i.transferReference}</span>
        </InfoRow>
        <InfoRow label={L.reachedAt}>{i.reachedAt ? formatDateTime(i.reachedAt) : EMPTY}</InfoRow>
        {i.paidAt && <InfoRow label={L.paidAt}>{formatDateTime(i.paidAt)}</InfoRow>}
        {i.cancelledAt && <InfoRow label={L.cancelledAt}>{formatDateTime(i.cancelledAt)}</InfoRow>}
      </dl>
      <div className="flex flex-wrap gap-4 text-[0.8125rem]">
        <Link
          href={PAYMENT_ROUTES.installments.ofOrder(i.orderId)}
          className="text-accent hover:underline"
        >
          {L.viewOrder}
        </Link>
        <Link
          href={PAYMENT_ROUTES.installments.byCustomer(i.customerId)}
          className="text-accent hover:underline"
        >
          {L.viewCustomer}
        </Link>
      </div>
    </Card>
  );
}
