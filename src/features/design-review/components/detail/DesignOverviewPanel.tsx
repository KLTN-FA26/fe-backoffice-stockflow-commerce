import { formatDateTime } from "@/lib/format/date";

import { waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";

import { DESIGN_DETAIL_LABELS as L, MONO } from "../copy";
import { LifecycleSteps, ProfileFact, ProfileFrame } from "@/components/shared/ObjectPage";

import type { Design } from "@/features/design-review/types";

const STEPS = [L.steps.DRAFT, L.steps.PENDING_REVIEW, L.steps.APPROVED];
const STEP_INDEX: Record<Design["status"], number> = {
  DRAFT: 0,
  PENDING_REVIEW: 1,
  APPROVED: 2,
  ARCHIVED: 3,
};

const DASH = <span className="text-ink-tertiary font-normal">—</span>;

/**
 * Khung hồ sơ thiết kế (backoffice-erp-ui B11): vòng đời nằm ngang ở đầu khung, dưới là 8 thông số khách gửi. Tên, mã và
 * trạng thái nằm ở đầu trang; bộ file và kiểm tra file in ở các panel bên dưới.
 */
export function DesignOverviewPanel({ design, now }: { design: Design; now: Date }) {
  const waiting = design.status === "PENDING_REVIEW" ? waitingSince(design, now) : null;
  const product = [design.productName, design.variantName].filter(Boolean).join(" · ");
  const steps = design.status === "ARCHIVED" ? [...STEPS, L.archived] : STEPS;
  return (
    <ProfileFrame
      label={L.profile}
      head={
        <LifecycleSteps label={L.lifecycle} steps={steps} current={STEP_INDEX[design.status]} />
      }
    >
      <ProfileFact label={L.customer}>
        {design.customerId ? (
          <CustomerName id={design.customerId} name={design.customerName} />
        ) : (
          DASH
        )}
      </ProfileFact>
      <ProfileFact label={L.product} title={product || undefined}>
        {product || DASH}
      </ProfileFact>
      <ProfileFact label={L.sku} title={design.sku ?? undefined}>
        {design.sku ? <span className={MONO}>{design.sku}</span> : DASH}
      </ProfileFact>
      <ProfileFact label={L.templateCode} title={design.templateCode ?? undefined}>
        {design.templateCode ? <span className={MONO}>{design.templateCode}</span> : DASH}
      </ProfileFact>
      <ProfileFact label={L.requestedAt}>
        {design.reviewRequestedAt ? (
          <span className="tabular-nums">{formatDateTime(design.reviewRequestedAt)}</span>
        ) : (
          DASH
        )}
      </ProfileFact>
      <ProfileFact label={L.waiting}>{waiting ?? DASH}</ProfileFact>
      <ProfileFact label={L.scope}>{design.projectId ? L.scopeProject : L.scopeSingle}</ProfileFact>
      <ProfileFact label={L.updatedAt}>
        {design.updatedAt ? (
          <span className="tabular-nums">{formatDateTime(design.updatedAt)}</span>
        ) : (
          DASH
        )}
      </ProfileFact>
    </ProfileFrame>
  );
}
