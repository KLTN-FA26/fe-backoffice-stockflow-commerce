"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { classifyLoadError } from "./load-error";

import type { LoadErrorKind } from "./load-error";

const { common, loadError, supplier } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: supplier.notFoundTitle, description: supplier.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: supplier.forbiddenDescription },
  "invalid-data": {
    title: loadError.invalidDataTitle,
    description: loadError.invalidDataDescription,
  },
  network: { title: loadError.networkTitle, description: loadError.networkDescription },
  server: { title: loadError.serverTitle, description: loadError.serverDescription },
};

interface SupplierLoadErrorProps {
  /** `null` = query thành công nhưng không có data → coi như không tìm thấy. */
  error: unknown;
  /** Ép loại lỗi (vd `forbidden` khi thiếu quyền, `network` khi query bị pause vì offline). */
  kind?: LoadErrorKind;
  onRetry?: () => void;
  /** Hiện trong vùng bảng (trang danh sách): không vẽ PageHeader, không có nút "Về danh sách". */
  inline?: boolean;
}

/** Trạng thái lỗi dùng chung cho trang chi tiết + sửa NCC. */
export function SupplierLoadError({
  error,
  kind: forcedKind,
  onRetry,
  inline = false,
}: SupplierLoadErrorProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const copy = COPY[kind];
  const apiErr = error instanceof ApiError ? error : undefined;
  const description = kind === "server" && apiErr?.message ? apiErr.message : copy.description;
  const canRetry =
    onRetry !== undefined && (kind === "network" || kind === "server" || kind === "invalid-data");

  return (
    <>
      {!inline && <PageHeader title={supplier.pageTitle} />}
      <EmptyState
        title={copy.title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {canRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {common.retry}
              </Button>
            ) : null}
            {!inline && (
              <Button variant="outline" size="sm" asChild>
                <Link href={ADMIN_ROUTES.suppliers.list}>{common.backToList}</Link>
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
