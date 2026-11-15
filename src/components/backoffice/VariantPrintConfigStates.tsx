"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { PRINT_CONFIG_PAGE_LABELS as TEXT } from "@/constants/labels-print-config";
import { classifyLoadError } from "@/lib/api/load-error";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/** Trạng thái không có gì để cấu hình: không tìm thấy (sản phẩm / biến thể) hoặc tải lỗi, cùng khung với trang chi tiết. */
export function VariantPrintConfigState({
  kind,
  error,
  onRetry,
}: {
  kind: "variant-missing" | "failed";
  /** Lỗi tải: chỉ 404 / 400 là "không tìm thấy"; còn lại có Thử lại. */
  error?: unknown;
  onRetry?: () => void;
}) {
  // Không có dữ liệu mà cũng không lỗi (hoặc 404) → sản phẩm không tồn tại
  const productMissing = kind === "failed" && (!error || classifyLoadError(error) === "not-found");
  const copy = productMissing
    ? UI_LABELS.product.notFound
    : kind === "variant-missing"
      ? TEXT.variantNotFound
      : TEXT.loadFailed;
  const canRetry = kind === "failed" && !productMissing && onRetry;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{TEXT.pageTitle}</h1>
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex items-center gap-2">
            {canRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {UI_LABELS.common.retry}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={ADMIN_ROUTES.products.list}>{UI_LABELS.common.backToList}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
