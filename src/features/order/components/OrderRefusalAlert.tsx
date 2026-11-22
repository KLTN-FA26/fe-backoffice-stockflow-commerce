import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { OrderErrorView } from "../errors";

/**
 * Lý do máy chủ từ chối release, hiện NGAY trong hộp thoại: câu tiếng Việt (không hiện mã quy tắc BR-xx cho người
 * dùng — `view.rule` chỉ để test/đối chiếu docs), chi tiết rút từ máy chủ (SKU thiếu mẫu duyệt) và traceId để báo lỗi. Hộp thoại giữ nguyên dữ liệu đã nhập.
 */
export function OrderRefusalAlert({ view }: { view: OrderErrorView }) {
  return (
    <div role="alert">
      <Alert tone="danger" title={view.title}>
        <p>{view.detail}</p>
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
