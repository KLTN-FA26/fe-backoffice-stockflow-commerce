"use client";

import Link from "next/link";

import { ADMIN_ROUTES, ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { classifyOrderLoadError } from "../load-error";

import type { OrderLoadErrorKind } from "../load-error";

const { common, loadError, order } = UI_LABELS;

/**
 * Lỗi server dùng câu tiếng Việt chung (KHÁC NCC — NCC hiện `error.message` của BE): message BE
 * là tiếng Anh, re-review PR #12 đã yêu cầu không hiện thẳng cho người dùng.
 */
const COPY: Record<OrderLoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: order.notFoundTitle, description: order.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: order.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: order.noReadDescription },
  "invalid-data": {
    title: loadError.invalidDataTitle,
    description: loadError.invalidDataDescription,
  },
  network: { title: loadError.networkTitle, description: loadError.networkDescription },
  server: { title: loadError.serverTitle, description: loadError.serverDescription },
  permissions: {
    title: loadError.permissionsTitle,
    description: loadError.permissionsDescription,
  },
};

interface OrderLoadErrorProps {
  /** `null` = không có lỗi API cụ thể → dùng `kind` (mặc định "không tìm thấy"). */
  error: unknown;
  /** Ép loại lỗi (vd `forbidden` khi thiếu quyền, `network` khi query bị pause vì offline). */
  kind?: OrderLoadErrorKind;
  onRetry?: () => void;
  /** Hiện trong vùng bảng (trang danh sách): không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
}

/** Trạng thái lỗi / thiếu quyền dùng chung cho gate, trang chi tiết và danh sách đơn (như NCC). */
export function OrderLoadError({
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: OrderLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyOrderLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const isPermissionKind = kind === "forbidden" || kind === "no-read";
  const canRetry = onRetry !== undefined && kind !== "not-found" && !isPermissionKind;
  // Danh sách chỉ xem được khi có cả VIEW_PAGE lẫn READ; thiếu thì "Về danh sách" chỉ dẫn tới
  // một màn bị chặn khác → về trang tổng quan
  const canOpenList = useCan(ORDER_PERMISSIONS.viewPage);
  const canReadList = useCan(ORDER_PERMISSIONS.read);
  const back =
    isPermissionKind && !(canOpenList && canReadList)
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: ADMIN_ROUTES.orders.list, label: common.backToList };

  return (
    <>
      {!inline && <PageHeader title={order.pageTitle} />}
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex items-center gap-2">
            {canRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {common.retry}
              </Button>
            ) : null}
            {!inline && (
              <Button variant="outline" size="sm" asChild>
                <Link href={back.href}>{back.label}</Link>
              </Button>
            )}
          </div>
        }
      />
      {apiErr?.traceId ? (
        <p className="text-ink-tertiary mt-2 text-center text-xs">
          {common.traceId}:{" "}
          <span className="font-[family-name:var(--font-mono)]">{apiErr.traceId}</span>
        </p>
      ) : null}
    </>
  );
}
