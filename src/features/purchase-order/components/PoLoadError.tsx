"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, purchaseOrder } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": {
    title: purchaseOrder.notFoundTitle,
    description: purchaseOrder.notFoundDescription,
  },
  forbidden: { title: loadError.forbiddenTitle, description: purchaseOrder.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: purchaseOrder.noReadDescription },
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

interface PoLoadErrorProps {
  /** `null` = không có data → coi như không tìm thấy. */
  error: unknown;
  /** Ép loại lỗi (vd `forbidden` khi thiếu quyền). */
  kind?: LoadErrorKind;
  onRetry?: () => void;
  /** Hiện trong vùng bảng: không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
}

/** Trạng thái lỗi dùng chung cho các màn PO — 403 / 404 / 5xx / mất mạng tách riêng (§8). */
export function PoLoadError({
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: PoLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const isPermissionKind = kind === "forbidden" || kind === "no-read";
  const canRetry = onRetry !== undefined && kind !== "not-found" && !isPermissionKind;
  // Thiếu quyền mở danh sách thì "Về danh sách" chỉ dẫn tới một màn bị chặn khác → về tổng quan
  const canOpenList = useCan(PO_PERMISSIONS.viewPage);
  const canReadList = useCan(PO_PERMISSIONS.read);
  const back =
    isPermissionKind && !(canOpenList && canReadList)
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: ADMIN_ROUTES.purchaseOrders.list, label: common.backToList };

  return (
    <>
      {!inline && <PageHeader title={purchaseOrder.pageTitle} />}
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex items-center gap-2">
            {canRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {common.retry}
              </Button>
            )}
            {!inline && (
              <Button variant="outline" size="sm" asChild>
                <Link href={back.href}>{back.label}</Link>
              </Button>
            )}
          </div>
        }
      />
      {apiErr?.traceId && (
        <p className="text-ink-tertiary mt-2 text-center text-xs">
          {common.traceId}:{" "}
          <span className="font-[family-name:var(--font-mono)]">{apiErr.traceId}</span>
        </p>
      )}
    </>
  );
}
