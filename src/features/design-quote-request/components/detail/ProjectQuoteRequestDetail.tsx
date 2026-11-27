"use client";

import { parseAsString, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
} from "@/constants";

import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DetailPanel } from "@/components/shared/DetailPanel";
import {
  LifecycleSteps,
  ObjectHeader,
  ProfileFact,
  ProfileFrame,
} from "@/components/shared/ObjectPage";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useCloseProjectQuoteRequest } from "../../mutations";
import { useProjectQuoteRequest } from "../../queries";
import { QUOTE_REQUEST_COPY } from "../copy";
import { QuoteRequestActions } from "../QuoteRequestActions";
import { approvedProgress, RequestStatus, totalCartons } from "../quote-request-columns";
import { ProjectLineCard } from "./ProjectLineCard";

import type { ProjectQuoteRequest } from "../../types";

const C = COPY.columns;
const BACK = { href: ADMIN_ROUTES.designProjectQuoteRequests.list, label: "Về hộp yêu cầu dự án" };
/**
 * Tiến độ yêu cầu: khách gửi → duyệt đủ thiết kế → lập báo giá. Bước đang ở là việc phải làm tiếp; đã lập báo giá thì
 * qua hết. Đóng không báo giá dừng ở bước hiện tại.
 */
const STEPS = ["Khách gửi yêu cầu", "Duyệt đủ thiết kế", "Lập báo giá"] as const;
function currentStep(request: ProjectQuoteRequest): number {
  if (request.status === "CLOSED" && request.closedOutcome === "QUOTED") return STEPS.length;
  const { approved, total } = approvedProgress(request);
  return approved === total ? 2 : 1;
}

function DetailBody({ request }: { request: ProjectQuoteRequest }) {
  const close = useCloseProjectQuoteRequest();
  const canOpenDesign = useCan(DESIGN_PERMISSIONS.viewPage);
  const { approved, total } = approvedProgress(request);

  return (
    // Object page ERP (backoffice-erp-ui B10–B12), cùng mẫu trang sản phẩm: header → khung hồ sơ → dữ liệu chính.
    <div className="surface-soft surface-compact">
      <ObjectHeader
        name={request.projectName}
        code={request.id}
        codeLabel="Mã yêu cầu"
        status={<RequestStatus row={request} />}
        actions={<QuoteRequestActions row={request} close={close} />}
      />
      <ProfileFrame
        label="Hồ sơ yêu cầu báo giá"
        head={
          <LifecycleSteps label="Tiến độ yêu cầu" steps={STEPS} current={currentStep(request)} />
        }
        footer={
          request.closeReason ? (
            <>
              <p className="text-ink-tertiary mb-1 text-xs">{COPY.closeReason}</p>
              <p className="text-ink-primary max-w-[75ch] text-[0.8125rem]">
                {request.closeReason}
              </p>
            </>
          ) : undefined
        }
      >
        <ProfileFact label={C.customer}>
          <CustomerName id={request.customerId} name={request.customerName} />
        </ProfileFact>
        <ProfileFact label={C.designs}>
          <span className={approved === total ? "text-dot-positive" : undefined}>
            {COPY.approvedOf(approved, total)}
          </span>
        </ProfileFact>
        <ProfileFact label={C.totalCartons}>
          <span className="tabular-nums">{totalCartons(request)}</span>
        </ProfileFact>
        <ProfileFact label={C.delivery}>
          <span className="tabular-nums">
            {request.desiredDeliveryDate ? formatDate(request.desiredDeliveryDate) : "—"}
          </span>
        </ProfileFact>
        <ProfileFact label={C.requestedAt}>
          <span className="tabular-nums">{formatDateTime(request.requestedAt)}</span>
        </ProfileFact>
        <ProfileFact label="Số dòng">
          <span className="tabular-nums">{request.lines.length}</span>
        </ProfileFact>
        <ProfileFact label="Đóng lúc">
          <span className="tabular-nums">
            {request.closedAt ? formatDateTime(request.closedAt) : "—"}
          </span>
        </ProfileFact>
        <ProfileFact label="Báo giá">
          {request.quoteNumber ?? (request.status === "OPEN" ? "Chưa lập" : "—")}
        </ProfileFact>
      </ProfileFrame>

      {/* Dữ liệu chính hiện thẳng (B12): từng thiết kế con kèm ảnh xem trước. */}
      <DetailPanel
        title="Thiết kế trong yêu cầu"
        count={request.lines.length}
        description="Ảnh xem trước, trạng thái duyệt, SKU riêng và số thùng của từng thiết kế."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {request.lines.map((line) => (
            <ProjectLineCard key={line.designId} line={line} canOpenDesign={canOpenDesign} />
          ))}
        </div>
      </DetailPanel>
    </div>
  );
}

function DetailContent({ requestId }: { requestId: string }) {
  const [customerId] = useQueryState("customer", parseAsString.withDefault(""));
  const query = useProjectQuoteRequest(customerId, requestId);
  useBreadcrumbLabel(requestId, query.data?.projectName);

  if (!customerId)
    return <LoadErrorState error={null} kind="not-found" copy={QUOTE_REQUEST_COPY} back={BACK} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={QUOTE_REQUEST_COPY}
        back={BACK}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (!query.data)
    return <LoadErrorState error={null} kind="not-found" copy={QUOTE_REQUEST_COPY} back={BACK} />;
  return <DetailBody request={query.data} />;
}

/**
 * Trang chi tiết một yêu cầu báo giá dự án (BE `design-quote-requests:READ`): thông tin yêu cầu + từng thiết kế con kèm
 * ảnh xem trước. BE không có GET theo id → URL mang `?customer=` để tải yêu cầu của khách rồi tìm theo id.
 */
export function ProjectQuoteRequestDetail({ requestId }: { requestId: string }) {
  return (
    <PermissionBoundary permissions={[DESIGN_QUOTE_REQUEST_PERMISSIONS.read]}>
      <DetailContent requestId={requestId} />
    </PermissionBoundary>
  );
}
