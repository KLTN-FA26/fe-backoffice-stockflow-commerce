"use client";

import { WAREHOUSE_LOCATION_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import type { ReactNode } from "react";

const HTTP_FORBIDDEN = 403;

/**
 * Trạng thái tải của một mục trong panel vị trí: thiếu quyền (UI ẩn trước, BE vẫn chặn) / đang tải / lỗi — 403 là
 * vị trí ở kho ngoài phạm vi người xem. Có dữ liệu → `children`.
 */
export function SectionState({
  canRead,
  noPermission,
  isPending,
  error,
  children,
}: {
  canRead: boolean;
  noPermission: string;
  isPending: boolean;
  error: unknown;
  children: ReactNode;
}) {
  if (!canRead) return <p className="text-ink-tertiary text-xs">{noPermission}</p>;
  if (error)
    return (
      <Alert tone="danger">
        {error instanceof ApiError && error.status === HTTP_FORBIDDEN
          ? noPermission
          : L.detail.loadFailed}
      </Alert>
    );
  if (isPending) return <Skeleton className="h-16 w-full" />;
  return children;
}
