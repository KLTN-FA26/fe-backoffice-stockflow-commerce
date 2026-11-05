"use client";

import { SUPPLIER_PERMISSIONS } from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useSupplier } from "../queries";
import { SupplierForm } from "./SupplierForm";
import { SupplierLoadError } from "./SupplierLoadError";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

function EditSupplierContent({ id }: { id: string }) {
  const query = useSupplier(id);
  // Breadcrumb hiện mã NCC thay vì supplierId (UUID của BE)
  useBreadcrumbLabel(id, query.data?.code);

  if (query.isError) {
    return <SupplierLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    // Offline → query bị pause, không phải "không tìm thấy"
    if (query.fetchStatus === "paused") {
      return <SupplierLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }
  return <SupplierForm existingSupplier={query.data} />;
}

export function EditSupplierPage({ id }: { id: string }) {
  return (
    // Sửa cần mở trang + đọc dữ liệu cũ + quyền cập nhật
    <SupplierPermissionGate
      permissions={[
        SUPPLIER_PERMISSIONS.viewPage,
        SUPPLIER_PERMISSIONS.read,
        SUPPLIER_PERMISSIONS.update,
      ]}
    >
      <EditSupplierContent id={id} />
    </SupplierPermissionGate>
  );
}
