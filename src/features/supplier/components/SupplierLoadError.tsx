"use client";

import Link from "next/link";

import { ADMIN_ROUTES, SUPPLIER_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { classifyLoadError } from "./load-error";

import type { LoadErrorKind } from "./load-error";

const { common, loadError, supplier } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: supplier.notFoundTitle, description: supplier.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: supplier.forbiddenDescription },
  "no-read": { title: loadError.noReadTitle, description: supplier.noReadDescription },
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
  const isPermissionKind = kind === "forbidden" || kind === "no-read";
  const canRetry = onRetry !== undefined && kind !== "not-found" && !isPermissionKind;
  // Danh sách chỉ xem được khi có cả VIEW_PAGE (mở trang) lẫn READ (đọc dữ liệu); thiếu thì
  // "Về danh sách" chỉ dẫn tới một màn bị chặn khác → về trang tổng quan
  const canOpenList = useCan(SUPPLIER_PERMISSIONS.viewPage);
  const canReadList = useCan(SUPPLIER_PERMISSIONS.read);
  const back =
    isPermissionKind && !(canOpenList && canReadList)
      ? { href: ADMIN_ROUTES.home, label: common.backToHome }
      : { href: ADMIN_ROUTES.suppliers.list, label: common.backToList };

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
