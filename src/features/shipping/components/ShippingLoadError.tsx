"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  SHIPMENT_PERMISSIONS,
  SHIPPING_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, shipping } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: shipping.notFoundTitle, description: shipping.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: shipping.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: shipping.noReadDescription },
  "invalid-data": {
    title: loadError.invalidDataTitle,
    description: loadError.invalidDataDescription,
  },
  network: { title: loadError.networkTitle, description: loadError.networkDescription },
  server: { title: loadError.serverTitle, description: loadError.serverDescription },
  permissions: { title: loadError.permissionsTitle, description: loadError.permissionsDescription },
};

interface ShippingLoadErrorProps {
  /** `null` = không có data → coi như không tìm thấy. */
  error: unknown;
  kind?: LoadErrorKind;
  onRetry?: () => void;
  /** Trong vùng nội dung: không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
}

/** Trạng thái lỗi các màn xếp xe & bàn giao — 403 / 404 / 5xx / mất mạng tách riêng (api-conventions §8). */
export function ShippingLoadError({
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: ShippingLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const isPermissionKind = kind === "forbidden" || kind === "no-read";
  const canRetry = onRetry !== undefined && kind !== "not-found" && !isPermissionKind;
  const canOpenList = useCan(SHIPMENT_PERMISSIONS.viewPage);
  const back =
    isPermissionKind && !canOpenList
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: ADMIN_ROUTES.shipments.list, label: common.backToList };

  return (
    <>
      {!inline && <PageHeader title={shipping.pageTitle} />}
      <EmptyState
        title={copy.title}
        description={
          // BR-SEC-002: có quyền nhưng không phụ trách kho của chứng từ — nói đúng lý do
          apiErr?.code === "OUT_OF_DATA_SCOPE"
            ? SHIPPING_ERROR_MESSAGES.OUT_OF_DATA_SCOPE
            : copy.description
        }
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
