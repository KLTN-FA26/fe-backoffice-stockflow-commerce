"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_ROUTES } from "@/constants/payment";
import {
  RETURN_CHANNEL_LABELS,
  RETURN_LABELS,
  RETURN_OUTCOME_LABELS,
  RETURN_REASON_LABELS,
  RETURN_REFUSAL_REASON_LABELS,
} from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";
import { Card } from "@/components/shared/Card";

import { returnOutcome } from "../selectors";

import { CodeLink, InfoList, InfoRow, Money, ReturnStatusDot, When } from "./primitives";
import { ReturnParcelList } from "./ReturnParcelList";

import type { ReturnRequest } from "../types";

const D = RETURN_LABELS.detail;

/** Thông tin chung của yêu cầu: đơn, khách, lý do, nguồn, mô tả của khách. */
export function ReturnGeneralCard({ ret }: { ret: ReturnRequest }) {
  const outcome = returnOutcome(ret);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-primary font-[family-name:var(--font-mono)] text-sm font-semibold">
          {ret.rmaNumber}
        </h2>
        <ReturnStatusDot status={ret.status} />
      </div>
      <InfoList>
        <InfoRow label={D.order}>
          <CodeLink href={ADMIN_ROUTES.orders.detail(ret.orderId)}>{ret.orderNumber}</CodeLink>
        </InfoRow>
        <InfoRow label={D.customer}>
          <Link
            href={ADMIN_ROUTES.customers.detail(ret.customerId)}
            className="text-accent-text hover:underline"
          >
            {D.viewCustomer}
          </Link>
        </InfoRow>
        {/* WF-05 F-20: yêu cầu xử lý xong 0 đồng không bao giờ đọc là "Đã hoàn tiền" */}
        {outcome && <InfoRow label={D.outcome}>{RETURN_OUTCOME_LABELS[outcome]}</InfoRow>}
        <InfoRow label={D.reason}>{RETURN_REASON_LABELS[ret.reasonCode]}</InfoRow>
        <InfoRow label={D.channel}>{RETURN_CHANNEL_LABELS[ret.channel]}</InfoRow>
        <InfoRow label={D.requestedAt}>
          <When iso={ret.requestedAt} />
        </InfoRow>
        {ret.description && <InfoRow label={D.description}>{ret.description}</InfoRow>}
        {ret.lateClaimReason && <InfoRow label={D.lateClaim}>{ret.lateClaimReason}</InfoRow>}
        {ret.cancellationReason && (
          <InfoRow label={D.cancellationReason}>{ret.cancellationReason}</InfoRow>
        )}
      </InfoList>
    </Card>
  );
}

/** Các bước đã xảy ra: quyết định của Sale, hàng về kho, hoàn tiền — mỗi phần chỉ hiện khi đã có. */
export function ReturnProgressCard({ ret }: { ret: ReturnRequest }) {
  const { review, receipt, resolution } = ret;
  // BE-23: phiếu nháp đang đếm — giải thích vì sao chưa chốt nhận đủ / đề xuất / duyệt hoàn tiền được
  const draftOpen = ret.receiptDraftOpen === true;
  if (!review && !receipt && !resolution && !draftOpen) return null;
  const outcome = returnOutcome(ret);
  return (
    <Card className="space-y-4 text-[0.8125rem]">
      {review && (
        <section aria-label={D.review} className="space-y-2">
          <h3 className="text-ink-primary font-semibold">{D.review}</h3>
          <InfoList>
            <InfoRow label={D.decidedAt}>
              <When iso={review.decidedAt} />
            </InfoRow>
            {review.returnDeadline && ret.status === "AWAITING_RETURN" && (
              <InfoRow label={D.returnDeadline}>
                <When iso={review.returnDeadline} withTime={false} />
              </InfoRow>
            )}
            {review.note && <InfoRow label={D.reviewNote}>{review.note}</InfoRow>}
            {review.rejectionReason && (
              <InfoRow label={D.rejectionReason}>{review.rejectionReason}</InfoRow>
            )}
          </InfoList>
        </section>
      )}
      {receipt && (
        <section aria-label={D.receipt} className="space-y-2">
          <h3 className="text-ink-primary font-semibold">{D.receipt}</h3>
          <InfoList>
            <InfoRow label={D.receivedAt}>
              <When iso={receipt.receivedAt} />
            </InfoRow>
            <InfoRow label={D.quarantine}>
              <span className="font-[family-name:var(--font-mono)]">
                {receipt.locationCode ?? "—"}
              </span>
            </InfoRow>
            {receipt.goodsReceiptId && (
              <InfoRow label={D.receiptLink}>
                <CodeLink href={RETURN_ROUTES.receipts.detail(receipt.goodsReceiptId)}>
                  {D.receiptLink}
                </CodeLink>
              </InfoRow>
            )}
          </InfoList>
          <ReturnParcelList parcels={receipt.parcels ?? []} />
        </section>
      )}
      {draftOpen && <p className="text-ink-secondary">{D.receiptDraftOpen}</p>}
      {resolution && (
        <section aria-label={D.resolution} className="space-y-2">
          <h3 className="text-ink-primary font-semibold">{D.resolution}</h3>
          <InfoList>
            <InfoRow label={D.settlementAmount}>
              <Money amount={resolution.settlementAmount} currency={ret.currency} />
            </InfoRow>
            <InfoRow label={D.proposedAt}>
              <When iso={resolution.proposedAt} />
            </InfoRow>
            {resolution.note && <InfoRow label={D.reviewNote}>{resolution.note}</InfoRow>}
            {ret.refusalReason && (
              <InfoRow label={D.refusalReason}>
                {RETURN_REFUSAL_REASON_LABELS[ret.refusalReason]}
              </InfoRow>
            )}
            {ret.refusalReason && ret.refusalNote && (
              <InfoRow label={D.refusalNote}>{ret.refusalNote}</InfoRow>
            )}
            {resolution.settledAt && (
              <>
                <InfoRow label={D.settledAt}>
                  <When iso={resolution.settledAt} />
                </InfoRow>
                <InfoRow label={D.offsetAmount}>
                  <Money amount={resolution.offsetAmount} currency={ret.currency} />
                </InfoRow>
                <InfoRow label={D.refundedAmount}>
                  <Money amount={resolution.refundedAmount} currency={ret.currency} />
                </InfoRow>
              </>
            )}
          </InfoList>
          {/* WF-05 Q-4 / TH-4: kết thúc không hoàn tiền — giá trị 0, không có gì ở màn hoàn tiền */}
          {outcome === "REFUSED" && <p className="text-ink-secondary">{D.refusedNote}</p>}
          {outcome === "NOTHING_TO_REFUND" && (
            <p className="text-ink-secondary">{D.closedWithoutRefund}</p>
          )}
          {resolution.settledAt && outcome === "REFUNDED" && (
            <div className="flex flex-wrap gap-3">
              <Link
                href={PAYMENT_ROUTES.refunds.ofOrder(ret.orderId)}
                className="text-accent-text hover:underline"
              >
                {D.openRefunds}
              </Link>
              {resolution.vatAdjustmentRequired && (
                <span className="text-ink-secondary">{D.vatAdjustment}</span>
              )}
            </div>
          )}
        </section>
      )}
    </Card>
  );
}
