"use client";

import { AlertTriangle, FileText } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS, PAYMENT_LIST_LABELS } from "@/constants/labels-payment";
import { formatDateTime } from "@/lib/format/date";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { DetailSection } from "@/components/shared/DetailSection";

import { blocksHandover, deliveryBatchLabel, installmentTitle, milestoneLabel } from "../selectors";

import { CodeLink, DateCell, InfoRow, MoneyCell } from "./primitives";

import type { Installment } from "../types";

const L = PAYMENT_LABELS.detail;
const C = PAYMENT_LABELS.columns;
const EMPTY = PAYMENT_LABELS.empty;

/**
 * "Thông tin chung" của một đợt thanh toán (cột trái của trang chi tiết hai cột — BO-UX-2): tên đợt, mốc, đợt giao gắn
 * kèm, tiền, hạn trả, nội dung chuyển khoản (docs 15 §4.1, §5.1). Trạng thái và thao tác nằm ở thẻ bên phải.
 */
export function InstallmentInfoCard({ installment: i }: { installment: Installment }) {
  return (
    <DetailSection title={PAYMENT_LIST_LABELS.generalTitle} icon={FileText}>
      <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
        <InfoRow label={C.installment}>
          <span className="text-ink-primary font-medium">{installmentTitle(i)}</span>
        </InfoRow>
        <InfoRow label={C.contract}>{i.contractNumber}</InfoRow>
        <InfoRow label={C.order}>
          <CodeLink href={ADMIN_ROUTES.orders.detail(i.orderId)}>{i.orderNumber}</CodeLink>
        </InfoRow>
        <InfoRow label={C.customer}>
          <CustomerName id={i.customerId} name={i.customerName} code={i.customerCode} />
        </InfoRow>
        <InfoRow label={C.milestone}>{milestoneLabel(i.milestone)}</InfoRow>
        <InfoRow label={C.deliveryBatch}>
          {deliveryBatchLabel(i)}
          {blocksHandover(i) && (
            <span className="text-ink-primary ml-2 inline-flex items-center gap-1 text-xs">
              <AlertTriangle className="text-dot-warning size-3.5" aria-hidden="true" />
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
    </DetailSection>
  );
}
