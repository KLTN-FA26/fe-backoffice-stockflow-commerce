import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { OrderErrorView } from "../errors";

/**
 * Lý do máy chủ từ chối thao tác (release / duyệt công nợ / huỷ) — hiện NGAY trong dialog, kèm
 * mã BR để Coordinator đối chiếu docs, chi tiết gốc (vd SKU thiếu mẫu) và traceId để báo lỗi.
 */
export function OrderRefusalAlert({ view }: { view: OrderErrorView }) {
  return (
    <div role="alert">
      <Alert tone="danger" title={view.title}>
        <p>{view.detail}</p>
        {view.rule && (
          <p className="mt-1 text-xs">
            Quy tắc: <span className="font-[family-name:var(--font-mono)]">{view.rule}</span>
          </p>
        )}
        {view.serverDetail && (
          <p className="mt-1 font-[family-name:var(--font-mono)] text-xs break-words opacity-80">
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
