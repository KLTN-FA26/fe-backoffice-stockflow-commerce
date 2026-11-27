"use client";

import Link from "next/link";

import {
  BANK_TRANSACTION_LABELS,
  BANK_TRANSACTION_PERMISSIONS,
  BANK_TRANSACTION_ROUTES,
} from "@/constants/bank-transaction";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { Notice } from "@/components/shared/Notice";
import { ObjectHeader } from "@/components/shared/ObjectPage";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { allowedBankTransactionActions } from "../lifecycle";
import { useBankTransaction } from "../queries";
import { reviewReasonText } from "../selectors";

import { BankTransactionActions } from "./BankTransactionActions";
import { BANK_TRANSACTION_COPY, BankTransactionStatusDot, MONO } from "./primitives";

const DASH = "—";

function BankTransactionDetailContent({ id }: { id: string }) {
  const canRead = useCan(BANK_TRANSACTION_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useBankTransaction(id, { enabled: canRead });
  const t = query.data;
  useBreadcrumbLabel(id, t ? formatMoney(t.amount, t.currency) : undefined);
  const back = { href: BANK_TRANSACTION_ROUTES.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={BANK_TRANSACTION_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={BANK_TRANSACTION_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (!t) return <PageSkeleton variant="detail" />;
  const reason = reviewReasonText(t.reviewReason);

  return (
    <div className="surface-soft surface-compact space-y-5">
      <ObjectHeader
        name={`${BANK_TRANSACTION_LABELS.pageTitle} ${formatMoney(t.amount, t.currency)}`}
        code={t.providerTransactionId ?? t.id}
        codeLabel="Mã giao dịch SePay"
        status={<BankTransactionStatusDot status={t.status} />}
        meta={<span>{t.source === "CATCH_UP" ? "Đối soát bù" : "Webhook"}</span>}
        actions={
          <BankTransactionActions
            transaction={t}
            actions={allowedBankTransactionActions(t.status, can)}
          />
        }
      />
      {t.status === "NEEDS_REVIEW" && reason && (
        <Notice tone="warning">
          <p className="font-medium">{reason}</p>
          {t.reviewNote && <p className="text-ink-tertiary mt-1 text-xs">{t.reviewNote}</p>}
        </Notice>
      )}
      <DetailPanel title="Giao dịch">
        <FactGrid>
          <Fact label="Số tiền">{formatMoney(t.amount, t.currency)}</Fact>
          <Fact label="Thời điểm ngân hàng ghi">
            {t.transactionAt ? formatDateTime(t.transactionAt) : DASH}
          </Fact>
          <Fact label="Tài khoản nhận" mono>
            {t.accountNumber ?? DASH}
          </Fact>
          <Fact label="Mã tham chiếu ngân hàng" mono>
            {t.bankReference ?? DASH}
          </Fact>
          <Fact label="Mã thanh toán" mono>
            {t.paymentCode ?? DASH}
          </Fact>
          <Fact label="Khách (gợi ý)">
            {t.customerName ?? t.customerCode ?? DASH}
            {t.customerName && t.customerCode && (
              <span className={`${MONO} text-ink-tertiary block font-normal`}>
                {t.customerCode}
              </span>
            )}
          </Fact>
          <Fact label="Nhận lúc">{formatDateTime(t.receivedAt)}</Fact>
        </FactGrid>
        <p className={`${MONO} text-ink-primary mt-4 text-[0.8125rem] break-words`}>
          <span className="text-ink-tertiary font-sans">Nội dung: </span>
          {t.content ?? DASH}
        </p>
      </DetailPanel>
      {(t.status === "APPLIED" || t.status === "IGNORED") && (
        <DetailPanel title="Kết quả">
          <FactGrid>
            {t.receiptId && (
              <Fact label="Phiếu thu">
                <Link
                  href={PAYMENT_ROUTES.receipts.detail(t.receiptId)}
                  className={`${MONO} text-accent-text hover:underline`}
                >
                  {t.receiptReference ?? t.receiptId}
                </Link>
              </Fact>
            )}
            <Fact label="Người xử lý">
              {t.automatic ? BANK_TRANSACTION_LABELS.automatic : (t.reviewedByName ?? DASH)}
            </Fact>
            <Fact label="Lúc">
              {t.reviewedAt || t.decidedAt
                ? formatDateTime(t.reviewedAt ?? t.decidedAt ?? "")
                : DASH}
            </Fact>
            {t.ignoreReason && <Fact label="Lý do bỏ qua">{t.ignoreReason}</Fact>}
          </FactGrid>
        </DetailPanel>
      )}
    </div>
  );
}

/** Chi tiết giao dịch ngân hàng SePay — gán vào đợt / bỏ qua khi đang chờ xử lý. */
export function BankTransactionDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[BANK_TRANSACTION_PERMISSIONS.viewPage]}>
      <BankTransactionDetailContent id={id} />
    </PermissionBoundary>
  );
}
