"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Undo2, Wallet } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_REFUND_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DETAIL_GRID_CLASS,
  DetailCardTitle,
  DetailSection,
} from "@/components/shared/DetailSection";
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
  const customer = refund.records?.[0];

  return (
    // Trang chi tiết hai cột như báo giá (BO-UX-2): các lần tính và ghi nhận bên trái; số phải hoàn, tình trạng và nút
    // "Ghi nhận đã hoàn" bên phải. Không nút quay lại — breadcrumb.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${L.pageTitle} ${refund.orderNumber}`}</h1>
      <div className={DETAIL_GRID_CLASS}>
        <div className="min-w-0 space-y-5">
          {(refund.settlements ?? []).length > 0 && (
            <DetailSection title={L.settlements} icon={Calculator}>
              <RefundSettlements refund={refund} />
            </DetailSection>
          )}
          <RefundRecords
            records={refund.records ?? []}
            canVoid={(record) =>
              allowedRefundRecordActions(record, can).includes("voidRefundRecord")
            }
            onVoid={setVoiding}
          />
        </div>
        <div className="space-y-5">
          <section className={DETAIL_CARD_CLASS}>
            <DetailCardTitle icon={Wallet}>{L.summary}</DetailCardTitle>
            <div className="mb-3">
              <RefundStateDot status={refund.refundStatus} />
            </div>
            <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-3 gap-y-2 text-[0.8125rem]">
              <InfoRow label={PAYMENT_LABELS.columns.order}>
                <Link
                  href={ADMIN_ROUTES.orders.detail(refund.orderId)}
                  className="text-accent-text font-mono hover:underline"
                >
                  {refund.orderNumber}
                </Link>
              </InfoRow>
              {/* #286: khách của đơn lấy từ ghi nhận hoàn (BE kèm tên + mã) — không tra danh mục khách */}
              {customer && (
                <InfoRow label={PAYMENT_LABELS.receipts.customerChip}>
                  <CustomerName
                    id={customer.customerId}
                    name={customer.customerName}
                    code={customer.customerCode}
                  />
                </InfoRow>
              )}
              <InfoRow label={L.refundable}>
                <MoneyCell amount={refund.refundable} currency={refund.currency} />
              </InfoRow>
              <InfoRow label={L.refunded}>
                <MoneyCell amount={refund.refunded} currency={refund.currency} />
              </InfoRow>
              <InfoRow label={L.remaining}>
                <MoneyCell amount={refund.remaining} currency={refund.currency} />
              </InfoRow>
              {refund.feeOwed != null && refund.feeOwed > 0 && (
                <InfoRow label={L.orderFeeOwed}>
                  <MoneyCell amount={refund.feeOwed} currency={refund.currency} />
                </InfoRow>
              )}
            </dl>
            {refund.feeOwed != null && refund.feeOwed > 0 && (
              <p className="text-warning-ink mt-3 text-xs">{L.orderFeeOwedHint}</p>
            )}
            <p className="text-ink-tertiary mt-3 text-xs">{L.outsideNote}</p>
            {canRecord && (
              <Button
                className={`mt-4 ${DETAIL_ACTION_CLASS.primary}`}
                onClick={() => setRecording(true)}
              >
                <Undo2 className="size-3.5" aria-hidden="true" /> {L.recordAction}
              </Button>
            )}
          </section>
        </div>
      </div>
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
