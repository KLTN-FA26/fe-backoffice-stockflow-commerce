import { DESIGN_REVIEW_LABELS } from "@/constants";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { DetailPanel } from "@/components/shared/DetailPanel";

import { DESIGN_DETAIL_LABELS as L, PREVIEW_CONTENT_TYPE } from "../copy";

import type { Design } from "@/features/design-review/types";

/**
 * Ảnh xem trước khách gửi (`previewUrl`, link ký ngắn hạn). BO không dựng 3D từ bố cục của khách — ảnh xem trước + file in
 * PDF + mô tả thiết kế là đủ để duyệt. Câu "màu in thật có thể khác" luôn hiện (module 12).
 */
export function DesignPreview({ design, onRefresh }: { design: Design; onRefresh: () => void }) {
  return (
    <DetailPanel title={L.preview} description={DESIGN_REVIEW_LABELS.colorDisclaimer}>
      {design.previewUrl ? (
        <SignedFilePreview
          url={design.previewUrl}
          contentType={PREVIEW_CONTENT_TYPE}
          alt={`Ảnh xem trước ${design.name}`}
          onRefresh={onRefresh}
        />
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noPreview}</p>
      )}
    </DetailPanel>
  );
}
