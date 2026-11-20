import { FileText } from "lucide-react";

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";

import { MONO } from "../copy";

import type { Design } from "@/features/design-review/types";

/** "Thông tin chung" — trang chi tiết không có tiêu đề, nên tên thiết kế là dòng đầu của mục này. */
export function DesignGeneral({ design, now }: { design: Design; now: Date }) {
  const waiting = design.status === "PENDING_REVIEW" ? waitingSince(design, now) : null;
  return (
    <DetailSection title="Thông tin chung" icon={FileText}>
      {design.projectId && (
        <Notice tone="info" className="mb-2">
          {DESIGN_REVIEW_LABELS.inProject}
        </Notice>
      )}
      <div className="divide-y divide-(--table-line)">
        <InfoRow label="Tên thiết kế">
          <span className="font-medium">{design.name}</span>
        </InfoRow>
        <InfoRow label="Khách hàng">
          {design.customerId ? <CustomerName id={design.customerId} /> : "—"}
        </InfoRow>
        <InfoRow label="Sản phẩm · biến thể">
          {[design.productName, design.variantName].filter(Boolean).join(" · ") || "—"}
        </InfoRow>
        <InfoRow label="SKU phôi">
          {design.sku ? <span className={MONO}>{design.sku}</span> : "—"}
        </InfoRow>
        <InfoRow label="Mã cấu hình in">
          {design.templateCode ? <span className={MONO}>{design.templateCode}</span> : "—"}
        </InfoRow>
        <InfoRow label="Gửi duyệt lúc">
          <span className="tabular-nums">
            {design.reviewRequestedAt ? formatDateTime(design.reviewRequestedAt) : "—"}
            {waiting ? ` · ${waiting}` : ""}
          </span>
        </InfoRow>
      </div>
    </DetailSection>
  );
}
