"use client";

import { useState } from "react";
import { Ban, FileText, ListOrdered } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS, PAYMENT_LIST_LABELS } from "@/constants/labels-payment";
import { PAYMENT_RECEIPT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { BUSINESS_DOCUMENT_PATHS } from "@/lib/api/business-documents";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { DocumentDownloadButton } from "@/components/backoffice/DocumentDownloadButton";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DETAIL_GRID_CLASS,
  DetailSection,
} from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedReceiptActions, receiptVoidBlock } from "../lifecycle";
import { useReceipt } from "../queries";
import { installmentMilestoneLabel, installmentTitle } from "../selectors";

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
  // WF-05 Q-20: BE nói trước phiếu không huỷ được → không hiện nút, nói lý do bằng tiếng Việt
  const voidBlock = receiptVoidBlock(receipt, can);

  return (
    // Trang chi tiết hai cột như báo giá (BO-UX-2): thông tin + các dòng bên trái; trạng thái, thông tin huỷ và nút huỷ
    // phiếu (cuối, tông nguy hiểm) bên phải. Không nút quay lại — breadcrumb.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${R.pageTitle} ${receipt.reference}`}</h1>
      <div className={DETAIL_GRID_CLASS}>
        <div className="min-w-0 space-y-5">
          <DetailSection title={PAYMENT_LIST_LABELS.generalTitle} icon={FileText}>
            <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
              <InfoRow label={C.reference}>
                <span className="text-ink-primary font-mono font-medium">{receipt.reference}</span>
              </InfoRow>
              <InfoRow label={C.customer}>
                <CustomerName
                  id={receipt.customerId}
                  name={receipt.customerName}
                  code={receipt.customerCode}
                />
              </InfoRow>
              <InfoRow label={C.receivedOn}>
                <DateCell iso={receipt.receivedOn} />
              </InfoRow>
              <InfoRow label={R.total}>
                <MoneyCell amount={receipt.amount} currency={receipt.currency} />
              </InfoRow>
              <InfoRow label={C.recordedAt}>{formatDateTime(receipt.recordedAt)}</InfoRow>
              {/* R5-8: tên người lập khi BE gửi — không hiện id người dùng */}
              {receipt.recordedByName && (
                <InfoRow label={PAYMENT_LIST_LABELS.recordedBy}>{receipt.recordedByName}</InfoRow>
              )}
              {receipt.note && <InfoRow label={R.note}>{receipt.note}</InfoRow>}
            </dl>
          </DetailSection>
          <DetailSection title={R.lines} icon={ListOrdered}>
            <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
              {receipt.lines.map((line) => (
                <li
                  key={line.installmentId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                >
                  <CodeLink href={PAYMENT_ROUTES.installments.detail(line.installmentId)}>
                    {/* Không có số hợp đồng → nhãn trung tính, không mảnh UUID (BO-UX-6) */}
                    {line.contractNumber ?? PAYMENT_LIST_LABELS.unknownContract}
                  </CodeLink>
                  {line.seq != null && <span>{installmentTitle({ ...line, seq: line.seq })}</span>}
                  {line.milestone && (
                    <span className="text-ink-secondary">
                      {installmentMilestoneLabel({ milestone: line.milestone, name: line.name })}
                    </span>
                  )}
                  {line.orderId && line.orderNumber && (
                    <CodeLink href={ADMIN_ROUTES.orders.detail(line.orderId)}>
                      {line.orderNumber}
                    </CodeLink>
                  )}
                  <span className="ml-auto">
                    <MoneyCell amount={line.amount} currency={receipt.currency} />
                  </span>
                  {/* BE feat/business-documents #5: một phiếu xác nhận cho mỗi đợt phiếu trả */}
                  {receipt.status === "RECORDED" && (
                    <DocumentDownloadButton
                      kind="paymentConfirmation"
                      size="xs"
                      label={R.confirmationPdf}
                      path={BUSINESS_DOCUMENT_PATHS.paymentConfirmation(
                        line.installmentId,
                        receipt.receiptId,
                      )}
                    />
                  )}
                </li>
              ))}
            </ul>
          </DetailSection>
        </div>
        <div className="space-y-5">
          <section className={DETAIL_CARD_CLASS} aria-label={PAYMENT_LIST_LABELS.statusTitle}>
            <div className="mb-4 flex justify-center">
              <ReceiptStatusDot status={receipt.status} />
            </div>
            {receipt.status === "VOIDED" && (
              <div className="space-y-1 text-[0.8125rem]">
                <h2 className="text-ink-primary font-semibold">{R.voidInfo}</h2>
                {/* R5-8: người huỷ khi BE gửi tên */}
                {receipt.voidedByName && (
                  <p className="text-ink-secondary">
                    {R.voidedBy}: {receipt.voidedByName}
                  </p>
                )}
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
            {voidBlock && (
              <div role="note" className="space-y-1 text-[0.8125rem]">
                <h2 className="text-ink-primary font-semibold">{R.voidBlockedTitle}</h2>
                <p className="text-ink-secondary">
                  {R.voidBlockedBy[voidBlock] ?? R.voidBlockedUnknown(voidBlock)}
                </p>
              </div>
            )}
            {canVoid && (
              <Button
                variant="ghost"
                className={DETAIL_ACTION_CLASS.danger}
                onClick={() => setVoiding(true)}
              >
                <Ban className="size-3.5" aria-hidden="true" /> {R.voidAction}
              </Button>
            )}
          </section>
        </div>
      </div>
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
