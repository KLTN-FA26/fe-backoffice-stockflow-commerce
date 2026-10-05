import { FileWarning, ShieldX, TriangleAlert, WifiOff } from "lucide-react";

import { ApiError } from "@/lib/api/error";

import type { LucideIcon } from "lucide-react";

/** Thông điệp lỗi tải danh sách — không hiện thẳng message tiếng Anh của server. */
export interface LoadErrorView {
  title: string;
  description: string;
  traceId?: string;
  icon: LucideIcon;
  /** 403 thử lại vô ích → ẩn nút "Thử lại". */
  retryable: boolean;
}

export function loadErrorView(error: unknown): LoadErrorView {
  if (!(error instanceof ApiError)) {
    // Zod parse fail = bug contract FE↔BE (api-conventions §8)
    return {
      title: "Dữ liệu trả về không đúng định dạng",
      description: "Phản hồi từ máy chủ không khớp hợp đồng. Vui lòng báo bộ phận kỹ thuật.",
      icon: FileWarning,
      retryable: true,
    };
  }
  const { traceId } = error;
  if (error.code === "NETWORK_ERROR" || error.status === 0) {
    return {
      title: "Không kết nối được máy chủ",
      description: "Vui lòng kiểm tra mạng và thử lại.",
      traceId,
      icon: WifiOff,
      retryable: true,
    };
  }
  if (error.status === 403) {
    return {
      title: "Bạn không có quyền",
      description: "Tài khoản của bạn không được xem danh sách đơn hàng.",
      traceId,
      icon: ShieldX,
      retryable: false,
    };
  }
  return {
    title: "Không tải được danh sách đơn hàng",
    description: "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.",
    traceId,
    icon: TriangleAlert,
    retryable: true,
  };
}
