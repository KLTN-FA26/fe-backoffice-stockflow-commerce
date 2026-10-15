"use client";

import { UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";
import { Alert } from "@/components/shared/Alert";

import { FulfillmentLoadError } from "../FulfillmentLoadError";

import type { FulfillmentScope } from "../primitives";

const { fulfillment } = UI_LABELS;

/**
 * Lỗi khi đọc ĐƠN HÀNG của task (dữ liệu phụ trợ, không phải task). 403 → báo đúng là thiếu quyền
 * xem đơn hàng; 404 ở đây là đơn, không phải task, nên không dùng câu "không tìm thấy task".
 */
export function OrderReadError({
  scope,
  error,
  onRetry,
}: {
  scope: FulfillmentScope;
  error: unknown;
  onRetry: () => void;
}) {
  const kind = classifyLoadError(error);
  if (kind === "forbidden") {
    return (
      <Alert tone="warning" title={fulfillment.noOrderReadTitle}>
        {fulfillment.noOrderReadDescription}
      </Alert>
    );
  }
  return (
    <FulfillmentLoadError
      inline
      scope={scope}
      error={error}
      kind={kind === "not-found" ? "server" : kind}
      onRetry={onRetry}
    />
  );
}
