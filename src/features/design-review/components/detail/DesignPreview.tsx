import { Image as ImageIcon } from "lucide-react";

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { DetailSection } from "@/components/shared/DetailSection";

import { PREVIEW_CONTENT_TYPE } from "../copy";

import type { Design } from "@/features/design-review/types";

/**
 * Ảnh xem trước khách gửi (`previewUrl`, link ký ngắn hạn). BO không dựng 3D từ bố cục của khách — ảnh xem trước + file in
 * PDF + mô tả thiết kế là đủ để duyệt.
 */
export function DesignPreview({ design, onRefresh }: { design: Design; onRefresh: () => void }) {
  return (
    <DetailSection title="Xem trước" icon={ImageIcon}>
      {design.previewUrl ? (
        <SignedFilePreview
          url={design.previewUrl}
          contentType={PREVIEW_CONTENT_TYPE}
          alt={`Ảnh xem trước ${design.name}`}
          onRefresh={onRefresh}
        />
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có ảnh xem trước.</p>
      )}
      <p className="text-ink-tertiary mt-2 text-xs">{DESIGN_REVIEW_LABELS.colorDisclaimer}</p>
    </DetailSection>
  );
}
