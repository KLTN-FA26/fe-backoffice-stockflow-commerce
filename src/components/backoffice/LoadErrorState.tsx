"use client";

import Link from "next/link";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError } = UI_LABELS;

export interface LoadErrorCopy {
  /** Tên màn (PageHeader khi không inline). */
  pageTitle: string;
  notFoundTitle: string;
  notFoundDescription: string;
  forbiddenDescription: string;
  noReadDescription: string;
}

interface LoadErrorStateProps {
  /** `null` = không có dữ liệu → coi như không tìm thấy. */
  error: unknown;
  kind?: LoadErrorKind;
  copy: LoadErrorCopy;
  onRetry?: () => void;
  /** Trong vùng nội dung danh sách: không vẽ PageHeader, không có nút quay lại. */
  inline?: boolean;
  back?: { href: string; label?: string };
}

/**
 * Trạng thái lỗi tải dữ liệu dùng chung cho các màn back-office mới (§8): 403 / 404 / 5xx /
 * mất mạng / sai hợp đồng tách riêng, kèm traceId. Không nuốt lỗi thành "không có dữ liệu".
 */
export function LoadErrorState({
  error,
  kind: forcedKind,
  copy,
  onRetry,
  inline = false,
  back,
}: LoadErrorStateProps) {
  const kind = forcedKind ?? (error ? classifyLoadError(error) : "not-found");
  const text: Record<LoadErrorKind, { title: string; description: string }> = {
    "not-found": { title: copy.notFoundTitle, description: copy.notFoundDescription },
    forbidden: { title: loadError.forbiddenTitle, description: copy.forbiddenDescription },
    "no-read": { title: loadError.noReadTitle, description: copy.noReadDescription },
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
  const apiErr = error instanceof ApiError ? error : undefined;
  const canRetry = onRetry !== undefined && !["not-found", "forbidden", "no-read"].includes(kind);

  return (
    <div role="alert">
      {!inline && <PageHeader title={copy.pageTitle} />}
      <EmptyState
        title={text[kind].title}
        description={text[kind].description}
        action={
          <div className="flex items-center gap-2">
            {canRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {common.retry}
              </Button>
            )}
            {!inline && back && (
              <Button variant="outline" size="sm" asChild>
                <Link href={back.href}>{back.label ?? common.backToList}</Link>
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
    </div>
  );
}
