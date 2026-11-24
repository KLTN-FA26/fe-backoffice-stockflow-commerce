"use client";

import { useState } from "react";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { PAYMENT_LABELS, PAYMENT_LIST_LABELS } from "@/constants/labels-payment";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { BUSINESS_DOCUMENT_PATHS } from "@/lib/api/business-documents";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
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

import { allowedInstallmentActions } from "../lifecycle";
import { useInstallment } from "../queries";
import { INSTALLMENT_COPY } from "./copy";
import { InstallmentStatusCell } from "./installment-columns";
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
    // Trang chi tiết hai cột như báo giá (BO-UX-2): mục thông tin bên trái; thẻ trạng thái + thao tác bên phải. Không nút
    // quay lại — breadcrumb dẫn về danh sách.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${PAYMENT_LABELS.installments.pageTitle} ${i.contractNumber}`}</h1>
      <div className={DETAIL_GRID_CLASS}>
        <div className="min-w-0 space-y-5">
          <InstallmentInfoCard installment={i} />
          <DetailSection title={L.receiptsTitle} icon={ReceiptText}>
            {(i.receipts ?? []).length === 0 ? (
              <p className="text-ink-tertiary text-[0.8125rem]">{L.noReceipts}</p>
            ) : (
              <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
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
                    {/* BE feat/business-documents #5 — phiếu đã huỷ không có phiếu xác nhận (404) */}
                    {receipt.status === "RECORDED" && (
                      <span className="ml-auto">
                        <DocumentDownloadButton
                          kind="paymentConfirmation"
                          size="xs"
                          label={PAYMENT_LABELS.receipts.confirmationPdf}
                          path={BUSINESS_DOCUMENT_PATHS.paymentConfirmation(
                            i.installmentId,
                            receipt.receiptId,
                          )}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </div>
        <div className="space-y-5">
          <section className={DETAIL_CARD_CLASS} aria-label={PAYMENT_LIST_LABELS.statusTitle}>
            <div className="mb-4 flex justify-center">
              <InstallmentStatusCell row={i} />
            </div>
            <div className="flex flex-col gap-2">
              {canRecord && (
                <Button className={DETAIL_ACTION_CLASS.primary} onClick={() => setRecording(true)}>
                  <ReceiptText className="size-3.5" aria-hidden="true" />{" "}
                  {PAYMENT_LABELS.receipts.createAction}
                </Button>
              )}
              <Button asChild variant="outline" className={DETAIL_ACTION_CLASS.outline}>
                <Link href={PAYMENT_ROUTES.installments.ofOrder(i.orderId)}>{L.viewOrder}</Link>
              </Button>
              <Button asChild variant="outline" className={DETAIL_ACTION_CLASS.outline}>
                <Link href={PAYMENT_ROUTES.installments.byCustomer(i.customerId)}>
                  {L.viewCustomer}
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
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
