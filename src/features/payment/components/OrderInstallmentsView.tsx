"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { parseAsString, useQueryState } from "nuqs";
import { CalendarClock, ReceiptText, Wallet } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DataTable } from "@/components/shared/DataTable";
import {
  DETAIL_CARD_CLASS,
  DetailCardTitle,
  DetailSection,
} from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { allowedInstallmentActions } from "../lifecycle";
import { useOrderInstallments } from "../queries";
import { installmentRef } from "../selectors";

import { ORDER_INSTALLMENTS_COPY } from "./copy";
import { buildInstallmentColumns } from "./installment-columns";
import { InfoRow, MoneyCell, OrderPaymentStatusDot } from "./primitives";
import { useRecordedReceipt } from "./ReceiptRecordedNotice";
import { RecordReceiptDialog } from "./RecordReceiptDialog";

import type { Installment } from "../types";

const O = PAYMENT_LABELS.order;
/**
 * Như `DETAIL_GRID_CLASS` nhưng thẻ bên phải rộng 360px (mã đơn / mã hợp đồng không bị ngắt hay tràn khỏi thẻ) và chỉ chia
 * hai cột từ 1400px: màn hẹp hơn thì thẻ nằm dưới bảng, bảng dùng cả bề ngang nên không cột nào bị cột Thao tác đè (S07-1).
 */
const ORDER_INSTALLMENTS_GRID_CLASS =
  "grid grid-cols-1 gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_360px]";
/** Chỉ nhận id / mã chuyến đúng dạng từ URL — liên kết "Quay lại chuyến" không dẫn tới chữ tuỳ ý. */
const RETURN_ID = /^[0-9a-f-]{8,64}$/i;
const RETURN_CODE = /^[A-Za-z0-9._-]{1,40}$/;

function OrderInstallmentsContent({ orderId }: { orderId: string }) {
  const canRead = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useOrderInstallments(orderId, canRead);
  useBreadcrumbLabel(orderId, query.data?.orderNumber);
  const [recording, setRecording] = useState<Installment | null>(null);
  // S07-5: đi từ lý do chặn bàn giao của một chuyến (`?loadId=&loadCode=`) thì sau khi lập phiếu có đường quay lại chuyến.
  const [loadId] = useQueryState("loadId", parseAsString);
  const [loadCode] = useQueryState("loadCode", parseAsString);
  const returnLoad =
    loadId && loadCode && RETURN_ID.test(loadId) && RETURN_CODE.test(loadCode)
      ? { loadId, loadCode }
      : null;
  const recorded = useRecordedReceipt(returnLoad);
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
  // BE: `paymentStatus` is null only when every installment is cancelled (WF-02 mục 26) — total / outstanding are 0 then.
  const allCancelled =
    !order.paymentStatus &&
    order.installments.length > 0 &&
    order.installments.every((row) => row.status === "CANCELLED");
  // BO-UX-42: một đơn → hợp đồng, đơn, khách giống nhau ở mọi dòng — bỏ ba cột đó (đã ở thẻ bên phải)
  const columns = buildInstallmentColumns(
    (row) =>
      allowedInstallmentActions(row, can).includes("recordReceipt") ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={`${PAYMENT_LABELS.receipts.createAction} — ${installmentRef(row)}`}
          onClick={() => setRecording(row)}
        >
          <ReceiptText className="size-3.5" aria-hidden="true" />{" "}
          {PAYMENT_LABELS.receipts.createAction}
        </Button>
      ) : null,
    // BO-UX-42 + S07-1: hợp đồng, đơn, khách giống nhau ở mọi dòng; "Số tiền" và "Đã thu" bỏ vì đã có "Còn phải thu" (số kế
    // toán cần khi lập phiếu; tổng đã thu và còn phải thu của đơn ở thẻ bên phải, từng khoản ở trang chi tiết đợt); mốc và
    // đợt giao gắn kèm xuống dòng phụ của tên đợt — bảng vừa khung, không cột nào bị cột Thao tác đè, không phải cuộn ngang.
    ["contract", "order", "customer", "amount", "paid", "milestone", "batch"],
  ).map((column) => ({
    ...column,
    sortable: false,
    // Ô và tiêu đề hẹp hơn mặc định (px-3.5): bảng năm cột vừa khung ở 1366px, không cuộn ngang dưới cột Thao tác (S07-1).
    className: cn(column.className, "px-2.5"),
    headerClassName: cn(column.headerClassName, "px-2.5"),
  }));
  const customer = order.installments[0];

  return (
    // Trang chi tiết kiểu Vercel (BO-UX-2): không nút quay lại — breadcrumb; bảng đợt bên trái, thẻ tình hình thanh toán
    // (trạng thái, đơn, hợp đồng, khách, số tiền) bên phải.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${O.summary} ${order.orderNumber}`}</h1>
      <div className={ORDER_INSTALLMENTS_GRID_CLASS}>
        <div className="min-w-0 space-y-5">
          {recorded.notice}
          <DetailSection title={O.installmentsTitle} icon={CalendarClock}>
            <DataTable
              columns={columns}
              data={order.installments}
              rowKey={(row) => row.installmentId}
              pageSize={50}
              caption={`${order.installments.length} ${PAYMENT_LABELS.installments.pageTitle.toLowerCase()}`}
            />
          </DetailSection>
        </div>
        <div className="space-y-5">
          <section className={DETAIL_CARD_CLASS}>
            <DetailCardTitle icon={Wallet}>{O.summary}</DetailCardTitle>
            <div className="mb-3">
              {order.paymentStatus ? (
                <OrderPaymentStatusDot status={order.paymentStatus} />
              ) : (
                <span className="text-ink-tertiary text-xs">{O.noPaymentStatus}</span>
              )}
            </div>
            <dl className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-x-3 gap-y-2 text-[0.8125rem]">
              <InfoRow label={PAYMENT_LABELS.columns.order}>
                <Link
                  href={ADMIN_ROUTES.orders.detail(order.orderId)}
                  className="text-accent-text font-mono whitespace-nowrap hover:underline"
                >
                  {order.orderNumber}
                </Link>
              </InfoRow>
              <InfoRow label={PAYMENT_LABELS.columns.contract}>
                <span className="font-mono whitespace-nowrap">{order.contractNumber}</span>
              </InfoRow>
              {customer && (
                <InfoRow label={PAYMENT_LABELS.columns.customer}>
                  <CustomerName
                    id={customer.customerId}
                    name={customer.customerName}
                    code={customer.customerCode}
                  />
                </InfoRow>
              )}
              {allCancelled ? (
                <InfoRow label={O.paidWhenCancelled}>
                  <MoneyCell amount={order.paid} currency={order.currency} />
                </InfoRow>
              ) : (
                <>
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
                </>
              )}
            </dl>
            <p className="text-ink-tertiary mt-3 text-xs">
              {allCancelled ? O.allCancelledHint : O.handoverHint}
            </p>
          </section>
        </div>
      </div>
      <RecordReceiptDialog
        installment={recording}
        onClose={() => setRecording(null)}
        onRecorded={recorded.onRecorded}
      />
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
