import { Box, WifiOff } from "lucide-react";
import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

interface OrderDetailErrorStateProps {
  id: string;
  /**
   * `null` = query thành công nhưng không có data (edge) → coi như không tìm thấy.
   * Không phải `ApiError` (vd ZodError khi parse response) = bug contract FE↔BE.
   */
  error: unknown;
  onRetry: () => void;
}

function TraceId({ traceId }: { traceId?: string }) {
  if (!traceId) return null;
  return (
    <p className="text-ink-tertiary mt-1 font-[family-name:var(--font-mono)] text-xs">
      traceId: {traceId}
    </p>
  );
}

/**
 * Coi như "không tìm thấy": 404, và 400 UNSUPPORTED_PARAMETER — BE khai báo `orderId` là UUID
 * (`OrderController#findOne`), id sai định dạng (gõ tay URL, link cũ) không bao giờ hợp lệ nên
 * "Thử lại" là vô ích.
 */
const NOT_FOUND_CODES: readonly string[] = ["NOT_FOUND", "UNSUPPORTED_PARAMETER"];

/** Trạng thái lỗi trang chi tiết: 404 · network · 403 · sai định dạng · còn lại (4xx/5xx). */
export function OrderDetailErrorState({ id, error, onRetry }: OrderDetailErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  // Có lỗi nhưng không phải ApiError → response không khớp schema (api-conventions §8)
  const isContract = error !== null && error !== undefined && !apiError;
  const isNotFound =
    !error ||
    apiError?.status === 404 ||
    (apiError !== null && NOT_FOUND_CODES.includes(apiError.code));
  const isNetwork = apiError?.code === "NETWORK_ERROR" || apiError?.status === 0;
  const isForbidden = apiError?.status === 403;

  if (isNotFound) {
    return (
      <>
        <PageHeader title="Không tìm thấy đơn hàng" subtitle="Đơn hàng không tồn tại." />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <Box className="mb-3 size-12 opacity-40" />
          <p className="text-[0.9375rem]">
            Đơn hàng <code className="text-accent font-[family-name:var(--font-mono)]">{id}</code>{" "}
            không tồn tại.
          </p>
          <Link
            href={ADMIN_ROUTES.orders.list}
            className="text-accent mt-4 text-[0.8125rem] hover:underline"
          >
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const title = isContract
    ? "Dữ liệu trả về không đúng định dạng"
    : isNetwork
      ? "Mất kết nối"
      : isForbidden
        ? "Bạn không có quyền"
        : "Không tải được đơn hàng";
  const subtitle = isContract
    ? "Phản hồi từ máy chủ không khớp hợp đồng. Vui lòng báo bộ phận kỹ thuật."
    : isNetwork
      ? "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại."
      : isForbidden
        ? "Tài khoản của bạn không được xem đơn hàng này."
        : "Đã xảy ra lỗi khi tải đơn hàng.";
  const Icon = isNetwork ? WifiOff : Box;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
        <Icon className="mb-3 size-12 opacity-40" />
        <p className="text-[0.9375rem]">{subtitle}</p>
        <TraceId traceId={apiError?.traceId} />
        {!isForbidden && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    </>
  );
}
