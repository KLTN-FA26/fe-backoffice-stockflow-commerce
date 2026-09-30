"use client";

import { Lock, ServerCrash } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { PoNotFound } from "./PoNotFound";

import type { ApiError } from "@/lib/api/error";

/**
 * Detail load failure, split by cause (api-conventions §8) instead of always "not found":
 * 404 / 400 (malformed id) → not found · 403 → no permission · else → retryable error.
 */
export function PoLoadError({
  id,
  error,
  onRetry,
}: {
  id: string;
  error: ApiError | null;
  onRetry: () => void;
}) {
  const status = error?.status ?? 404;
  if (status === 404 || status === 400) return <PoNotFound id={id} />;
  const forbidden = status === 403;
  return (
    <>
      <PageHeader title="Đơn đặt NCC" subtitle={id} />
      <EmptyState
        icon={forbidden ? <Lock className="size-10" /> : <ServerCrash className="size-10" />}
        title={forbidden ? "Bạn không có quyền xem PO này" : "Không tải được đơn đặt hàng"}
        description={
          forbidden
            ? "Liên hệ quản trị viên nếu bạn cần quyền truy cập."
            : `${error?.message ?? ""}${error?.traceId ? ` — traceId: ${error.traceId}` : ""}`
        }
        action={
          forbidden ? undefined : (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          )
        }
      />
    </>
  );
}
