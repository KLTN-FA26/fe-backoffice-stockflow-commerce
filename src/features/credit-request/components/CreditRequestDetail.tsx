"use client";

import {
  CREDIT_REQUEST_LABELS,
  CREDIT_REQUEST_PERMISSIONS,
  CREDIT_REQUEST_ROUTES,
} from "@/constants/credit-request";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { ObjectHeader } from "@/components/shared/ObjectPage";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { allowedCreditRequestActions } from "../lifecycle";
import { useCreditRequest } from "../queries";

import { CREDIT_REQUEST_COPY } from "./copy";
import { CreditRequestActions } from "./CreditRequestActions";
import { CreditRequestStatusDot } from "./CreditRequestStatusDot";
import { FilesPanel } from "./FilesPanel";
import { ReviewPanel } from "./ReviewPanel";

const DASH = "—";

function CreditRequestDetailContent({ id }: { id: string }) {
  const canRead = useCan(CREDIT_REQUEST_PERMISSIONS.read);
  const can = usePermissionChecker();
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const query = useCreditRequest(id, { enabled: canRead });
  const request = query.data;
  useBreadcrumbLabel(id, request?.customerName ?? undefined);
  const back = { href: CREDIT_REQUEST_ROUTES.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={CREDIT_REQUEST_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={CREDIT_REQUEST_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (!request) return <PageSkeleton variant="detail" />;
  const money = (amount: number | null | undefined) =>
    amount == null ? DASH : formatMoney(amount, request.currency);
  const actions = allowedCreditRequestActions(request, can, userId);

  return (
    <div className="surface-soft surface-compact space-y-5">
      <ObjectHeader
        name={`${CREDIT_REQUEST_LABELS.pageTitle} — ${request.customerName ?? DASH}`}
        code={request.id}
        codeLabel="Mã đề nghị"
        status={<CreditRequestStatusDot status={request.status} />}
        meta={<span>{CREDIT_REQUEST_LABELS.source[request.source] ?? request.source}</span>}
        actions={<CreditRequestActions request={request} actions={actions} />}
      />
      <DetailPanel title="Đề nghị">
        <FactGrid>
          <Fact label="Khách hàng">
            <CustomerName
              id={request.customerId}
              name={request.customerName}
              code={request.customerCode}
            />
          </Fact>
          <Fact label="Hạn mức xin">{money(request.requestedLimit)}</Fact>
          <Fact label="Kỳ hạn xin">{request.requestedTermDays} ngày</Fact>
          <Fact label="Gửi lúc">
            {formatDateTime(request.submittedAt)}
            {request.submittedByName && (
              <span className="text-ink-tertiary block font-normal">{request.submittedByName}</span>
            )}
          </Fact>
        </FactGrid>
        {request.reason && (
          <p className="text-ink-secondary mt-4 text-[0.8125rem] whitespace-pre-line">
            <span className="text-ink-tertiary">Lý do: </span>
            {request.reason}
          </p>
        )}
      </DetailPanel>
      {(request.salesNote || request.salesRecommendedLimit != null) && (
        <DetailPanel title="Ý kiến của Sale" description="Chỉ nội bộ thấy.">
          <FactGrid columns={3}>
            <Fact label="Hạn mức đề xuất">{money(request.salesRecommendedLimit)}</Fact>
            <Fact label="Người ghi">
              {request.recommendedByName ?? request.submittedByName ?? DASH}
            </Fact>
            <Fact label="Lúc">
              {request.recommendedAt ? formatDateTime(request.recommendedAt) : DASH}
            </Fact>
          </FactGrid>
          {request.salesNote && (
            <p className="text-ink-primary mt-4 text-[0.8125rem] whitespace-pre-line">
              {request.salesNote}
            </p>
          )}
        </DetailPanel>
      )}
      {request.decidedAt && (
        <DetailPanel title="Kết quả">
          <FactGrid>
            <Fact label="Hạn mức duyệt">{money(request.approvedLimit)}</Fact>
            <Fact label="Kỳ hạn duyệt">
              {request.approvedTermDays == null ? DASH : `${request.approvedTermDays} ngày`}
            </Fact>
            <Fact label="Người quyết">{request.decidedByName ?? DASH}</Fact>
            <Fact label="Lúc">{formatDateTime(request.decidedAt)}</Fact>
          </FactGrid>
          {request.decisionNote && (
            <p className="text-ink-primary mt-4 text-[0.8125rem] whitespace-pre-line">
              <span className="text-ink-tertiary">
                {request.status === "REJECTED" ? "Lý do từ chối: " : "Ghi chú: "}
              </span>
              {request.decisionNote}
            </p>
          )}
        </DetailPanel>
      )}
      {request.review && <ReviewPanel review={request.review} currency={request.currency} />}
      <FilesPanel request={request} canAttach={actions.includes("attach")} />
    </div>
  );
}

/** Chi tiết đề nghị cấp hạn mức (15 §4.3 bước 9–11a) — Sale ghi ý kiến, Kế toán duyệt / từ chối. */
export function CreditRequestDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[CREDIT_REQUEST_PERMISSIONS.viewPage]}>
      <CreditRequestDetailContent id={id} />
    </PermissionBoundary>
  );
}
