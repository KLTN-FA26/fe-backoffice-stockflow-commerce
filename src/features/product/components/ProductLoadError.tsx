"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { classifyLoadError } from "@/lib/api/load-error";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, product } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: product.notFound.title, description: product.notFound.description },
  forbidden: { title: loadError.forbiddenTitle, description: product.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: product.forbiddenDescription },
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

/**
 * Trang chi tiết sản phẩm tải lỗi (api-conventions §8): chỉ 404 (BE PRODUCT_NOT_FOUND) mới là "không
 * tìm thấy"; 403 / mất mạng / 5xx / sai hợp đồng tách riêng, có Thử lại + traceId khi BE trả.
 * `error` rỗng (không có dữ liệu, không lỗi) → coi như không tìm thấy.
 */
export function ProductLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const kind = error ? classifyLoadError(error) : "not-found";
  const copy = COPY[kind];
  const canRetry = kind !== "not-found" && kind !== "forbidden" && kind !== "no-read";
  const traceId = error instanceof ApiError ? error.traceId : undefined;

  return (
    // Cùng khung kiểu Vercel với trang chi tiết (ProductDetail) — không tiêu đề hiển thị, breadcrumb đã có.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{product.pageTitle}</h1>
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
            <Button variant="outline" size="sm" asChild>
              <Link href={ADMIN_ROUTES.products.list}>{common.backToList}</Link>
            </Button>
          </div>
        }
      />
      {traceId && (
        <p className="text-ink-tertiary mt-2 text-center text-xs">
          {common.traceId}: <span className="font-[family-name:var(--font-mono)]">{traceId}</span>
        </p>
      )}
    </div>
  );
}
