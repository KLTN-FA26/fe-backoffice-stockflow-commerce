"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES, SUPPLIER_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useActivateSupplier, useDeactivateSupplier, useSupplier } from "@/features/supplier";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { ContactChannelCard } from "./supplier-detail/ContactChannelCard";
import { GeneralInfoCard } from "./supplier-detail/GeneralInfoCard";
import { LifecycleSection } from "./supplier-detail/LifecycleSection";
import { PurchaseOrdersSection } from "./supplier-detail/PurchaseOrdersSection";
import { ActionCard, OverviewCard } from "./supplier-detail/SidebarCards";
import { TermsOpsCard } from "./supplier-detail/TermsOpsCard";
import { SupplierLoadError } from "./SupplierLoadError";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

import type { SupplierActionKey } from "@/features/supplier/lifecycle";

function SupplierDetailContent({ supplierId }: { supplierId: string }) {
  const [confirming, setConfirming] = useState<SupplierActionKey | null>(null);
  const can = usePermissionChecker();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = can(SUPPLIER_PERMISSIONS.read);
  const query = useSupplier(supplierId, { enabled: canRead });
  // Breadcrumb hiện mã NCC thay vì supplierId (UUID của BE)
  useBreadcrumbLabel(supplierId, query.data?.code);
  const activate = useActivateSupplier();
  const deactivate = useDeactivateSupplier();
  const isToggling = activate.isPending || deactivate.isPending;

  if (!canRead) return <SupplierLoadError error={null} kind="no-read" />;
  if (query.isError) {
    return <SupplierLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    // Offline → query bị pause; đang retry → vẫn là skeleton. Chỉ 404 mới là "không tìm thấy".
    if (query.fetchStatus === "paused") {
      return <SupplierLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }

  const supplier = query.data;
  const deactivating = confirming === "deactivate";
  const handleConfirm = () => {
    const mutation = deactivating ? deactivate : activate;
    mutation.mutate(supplier, { onSettled: () => setConfirming(null) });
  };

  return (
    <>
      <PageHeader
        title={supplier.name}
        subtitle={`${supplier.code} — hồ sơ nhà cung cấp`}
        actions={
          <Link
            href={ADMIN_ROUTES.suppliers.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Quay lại
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <GeneralInfoCard supplier={supplier} />
            <ContactChannelCard supplier={supplier} />
          </div>
          <TermsOpsCard supplier={supplier} />
          <PurchaseOrdersSection supplierId={supplier.supplierId} />
          <LifecycleSection status={supplier.status} />
        </div>
        <div className="space-y-5">
          <ActionCard
            supplier={supplier}
            can={can}
            isToggling={isToggling}
            onConfirm={setConfirming}
          />
          <OverviewCard supplier={supplier} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={deactivating ? "Ngừng hợp tác với nhà cung cấp?" : "Kích hoạt lại nhà cung cấp?"}
        description={
          deactivating
            ? "NCC sẽ không xuất hiện khi tạo PO mới. Nếu NCC còn đơn đặt hàng đang mở, hệ thống sẽ từ chối."
            : "Nhà cung cấp sẽ hoạt động trở lại và xuất hiện trong bộ chọn khi tạo PO."
        }
        confirmLabel={deactivating ? "Ngừng hợp tác" : "Kích hoạt lại"}
        variant={deactivating ? "danger" : "default"}
        loading={isToggling}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export function SupplierDetail({ id }: { id: string }) {
  return (
    <SupplierPermissionGate permissions={[SUPPLIER_PERMISSIONS.viewPage]}>
      <SupplierDetailContent supplierId={id} />
    </SupplierPermissionGate>
  );
}
