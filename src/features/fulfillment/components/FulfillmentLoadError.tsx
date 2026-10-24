"use client";

import Link from "next/link";

import { ADMIN_ROUTES, FULFILLMENT_PICK_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";
import type { FulfillmentScope } from "./primitives";

const { common, loadError, fulfillment } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: fulfillment.notFoundTitle, description: fulfillment.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: fulfillment.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: fulfillment.noReadDescription },
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

const SCOPE = {
  picking: { title: fulfillment.pickingTitle, list: ADMIN_ROUTES.picking.list },
  packing: { title: fulfillment.packingTitle, list: ADMIN_ROUTES.packing.list },
} as const;

interface FulfillmentLoadErrorProps {
  scope: FulfillmentScope;
  /** `null` = không có data → coi như không tìm thấy. */
  error: unknown;
  kind?: LoadErrorKind;
  onRetry?: () => void;
  /** Hiện trong vùng nội dung: không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
}

/** Trạng thái lỗi dùng chung cho hai màn xuất kho — 403 / 404 / 5xx / mất mạng tách riêng (§8). */
export function FulfillmentLoadError({
  scope,
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: FulfillmentLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const isPermissionKind = kind === "forbidden" || kind === "no-read";
  const canRetry = onRetry !== undefined && kind !== "not-found" && !isPermissionKind;
  const canReadList = useCan(FULFILLMENT_PICK_PERMISSIONS.read);
  const back =
    isPermissionKind && !canReadList
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: SCOPE[scope].list, label: common.backToList };

  const body = (
    <>
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
  if (inline) return body;
  return (
    // Cùng khung kiểu Vercel với trang chi tiết — không tiêu đề hiển thị, breadcrumb đã có.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{SCOPE[scope].title}</h1>
      {body}
    </div>
  );
}
