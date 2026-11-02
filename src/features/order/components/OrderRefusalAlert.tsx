import { ORDER_RELEASE_REFUSAL_LABELS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { OrderErrorView } from "../errors";

/**
 * Lý do máy chủ từ chối release, hiện NGAY trong hộp thoại: câu tiếng Việt, mã quy tắc để đối chiếu docs (BR-PRD-08 /
 * 09…), chi tiết rút từ máy chủ (SKU thiếu mẫu duyệt) và traceId để báo lỗi. Hộp thoại giữ nguyên dữ liệu đã nhập.
 */
export function OrderRefusalAlert({ view }: { view: OrderErrorView }) {
  return (
    <div role="alert">
      <Alert tone="danger" title={view.title}>
        <p>{view.detail}</p>
        {view.rule && (
          <p className="mt-1 text-xs">
            {ORDER_RELEASE_REFUSAL_LABELS.ruleLabel}:{" "}
            <span className="font-[family-name:var(--font-mono)]">{view.rule}</span>
          </p>
        )}
        {view.serverDetail && (
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs break-words">
            {view.serverDetail}
          </p>
        )}
        {view.traceId && (
          <p className="mt-1 text-xs opacity-80">
            {UI_LABELS.common.traceId}: {view.traceId}
          </p>
        )}
      </Alert>
    </div>
  );
}
