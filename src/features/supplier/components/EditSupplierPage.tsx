"use client";

import { use } from "react";
import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { SupplierForm } from "@/features/supplier/components/SupplierForm";
import { useSupplier } from "@/features/supplier/queries";

function NotFoundBlock() {
  return (
    <>
      <PageHeader
        title="Không tìm thấy nhà cung cấp"
        subtitle="Mã nhà cung cấp không tồn tại hoặc đã bị xoá."
      />
      <EmptyState
        title="Không tìm thấy nhà cung cấp"
        description="Mã nhà cung cấp không tồn tại hoặc đã bị xoá."
        action={
          <Link href={ADMIN_ROUTES.suppliers.list}>
            <Button variant="outline" size="sm">
              Về danh sách
            </Button>
          </Link>
        }
      />
    </>
  );
}

export function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useSupplier(id);

  if (query.isLoading) return <PageSkeleton variant="detail" />;

  if (query.isError) {
    const err = query.error;
    const apiErr = err instanceof ApiError ? err : undefined;
    // 404 hoặc không xác định được lỗi cụ thể → coi như không tồn tại
    if (!apiErr || apiErr.status === 404) return <NotFoundBlock />;
    return (
      <>
        <PageHeader title="Không tải được dữ liệu" subtitle="Vui lòng thử lại." />
        <EmptyState
          title="Không tải được dữ liệu"
          description={apiErr.message || "Đã xảy ra lỗi khi tải nhà cung cấp."}
          action={
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          }
        />
        {apiErr.traceId ? (
          <p className="text-ink-tertiary mt-2 text-center text-xs">TraceId: {apiErr.traceId}</p>
        ) : null}
      </>
    );
  }

  if (!query.data) return <NotFoundBlock />;

  return <SupplierForm existingSupplier={query.data} />;
}
