"use client";

import { useState } from "react";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS, VARIANT_PERMISSIONS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useCustomer } from "@/features/customer/queries";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { CUSTOMER_COPY } from "./copy";
import { CustomerDetailTabs } from "./detail/CustomerDetailTabs";
import { CustomerEditDialog } from "./detail/CustomerEditDialog";
import { CustomerObjectHeader } from "./detail/CustomerObjectHeader";
import { CustomerOverviewPanel } from "./detail/CustomerOverviewPanel";
import { CustomerSkusCard } from "./detail/CustomerSkusCard";

function CustomerDetailContent({ id }: { id: string }) {
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useCustomer(id, { enabled: canRead });
  const [editOpen, setEditOpen] = useState(false);
  useBreadcrumbLabel(id, query.data?.fullName);

  const back = { href: ADMIN_ROUTES.customers.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={CUSTOMER_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={CUSTOMER_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;

  const customer = query.data;

  return (
    // Object page ERP (backoffice-erp-ui B10): header đối tượng → khung hồ sơ (vòng đời, thông số) → bảng SKU riêng hiện
    // thẳng (dữ liệu dùng nhiều nhất) → tab cho pháp lý & công nợ, lời mời portal, lịch sử trạng thái.
    <div className="surface-soft surface-compact">
      <CustomerObjectHeader customer={customer} can={can} />
      <CustomerOverviewPanel
        customer={customer}
        onEdit={can(CUSTOMER_PERMISSIONS.update) ? () => setEditOpen(true) : undefined}
      />
      <div className="mb-6">
        <CustomerSkusCard
          customerId={customer.customerId}
          canRead={can(VARIANT_PERMISSIONS.read)}
          canBlock={can(VARIANT_PERMISSIONS.update)}
          canApprove={can(VARIANT_PERMISSIONS.approve)}
        />
      </div>
      <CustomerDetailTabs customer={customer} can={can} />
      <CustomerEditDialog customer={customer} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage]}>
      <CustomerDetailContent id={id} />
    </PermissionBoundary>
  );
}
