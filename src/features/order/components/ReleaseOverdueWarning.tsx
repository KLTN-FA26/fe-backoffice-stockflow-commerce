"use client";

import { ORDER_RELEASE_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import { useReleaseWarnings } from "../queries";

interface ReleaseOverdueWarningProps {
  orderId: string;
}

/**
 * Cảnh báo ngay khi mở hộp thoại release: khách của đơn có đợt thanh toán quá hạn (BE `GET /orders/{id}/release-warnings`,
 * `creditWarning.outcome = OVERDUE`; WF4-OVERDUE-WARN, docs 15 §4.3 bước 11). Chỉ cảnh báo — nút Release vẫn dùng được và
 * BE không từ chối vì lý do này nữa. Đang tải / lỗi tải → không hiện gì (không toast lỗi, release vẫn đi tiếp).
 */
export function ReleaseOverdueWarning({ orderId }: ReleaseOverdueWarningProps) {
  const warnings = useReleaseWarnings(orderId);
  if (warnings.data?.creditWarning?.outcome !== "OVERDUE") return null;
  return (
    <div role="status">
      <Alert tone="warning">{ORDER_RELEASE_LABELS.overdueWarning}</Alert>
    </div>
  );
}
