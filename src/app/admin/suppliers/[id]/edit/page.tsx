"use client";

import { use } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SupplierForm } from "@/features/supplier/components/SupplierForm";
import { useSupplier } from "@/features/supplier/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES } from "@/constants";
import Link from "next/link";

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError } = useSupplier(id);
  if (isLoading) return <PageSkeleton variant="detail" />;
  if (isError || !data) {
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
  return <SupplierForm existingSupplier={data} />;
}
