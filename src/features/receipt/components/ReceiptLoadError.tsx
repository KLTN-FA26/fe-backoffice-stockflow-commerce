"use client";

import Link from "next/link";

import { ADMIN_ROUTES, GOODS_RECEIPT_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, receipt } = UI_LABELS;

/**
 * "no-po-read": có quyền phiếu nhận nhưng thiếu purchase-orders:READ (seed BE của NV kho).
 * "po-not-found": phiếu có nhưng API PO trả 404 cho PO của phiếu (trước C4: PO chưa có ở bảng cũ).
 */
export type ReceiptLoadErrorKind = LoadErrorKind | "no-po-read" | "po-not-found";

const COPY: Record<ReceiptLoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: receipt.notFoundTitle, description: receipt.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: receipt.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: receipt.noReadDescription },
  "no-po-read": { title: receipt.noPoReadTitle, description: receipt.noPoReadDescription },
  "po-not-found": { title: receipt.poNotFoundTitle, description: receipt.poNotFoundDescription },
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

interface ReceiptLoadErrorProps {
  /** `null` = không có data → coi như không tìm thấy. */
  error: unknown;
  kind?: ReceiptLoadErrorKind;
  onRetry?: () => void;
  /** Hiện trong vùng nội dung: không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
}

/** Trạng thái lỗi dùng chung cho các màn phiếu nhận — 403 / 404 / 5xx / mất mạng tách riêng (§8). */
export function ReceiptLoadError({
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: ReceiptLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const isPermissionKind = kind === "forbidden" || kind === "no-read" || kind === "no-po-read";
  const canRetry =
    onRetry !== undefined && kind !== "not-found" && kind !== "po-not-found" && !isPermissionKind;
  const canOpenList = useCan(GOODS_RECEIPT_PERMISSIONS.viewPage);
  const canReadList = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const back =
    isPermissionKind && !(canOpenList && canReadList)
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: ADMIN_ROUTES.receipts.list, label: common.backToList };

  return (
    <>
      {!inline && <PageHeader title={receipt.pageTitle} />}
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
