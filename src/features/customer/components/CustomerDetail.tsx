"use client";

import { useState } from "react";

import {
  ADMIN_ROUTES,
  CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_LEGAL_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { canResendInvitation, canViewInvitation } from "@/features/customer/lifecycle";
import { useCustomer } from "@/features/customer/queries";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DETAIL_GRID_CLASS } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { CUSTOMER_COPY } from "./copy";
import { CreditProfileCard } from "./detail/CreditProfileCard";
import { CustomerActionCard } from "./detail/CustomerActionCard";
import { CustomerEditDialog } from "./detail/CustomerEditDialog";
import { CustomerGeneralSection } from "./detail/CustomerGeneralSection";
import { CustomerSkusCard } from "./detail/CustomerSkusCard";
import { InvitationCard } from "./detail/InvitationCard";
import { LegalProfileCard } from "./detail/LegalProfileCard";
import { StatusHistoryCard } from "./detail/StatusHistoryCard";

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
    // Giao diện kiểu Vercel như trang chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên khách và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{customer.fullName}</h1>
      <div className={DETAIL_GRID_CLASS}>
        <div className="min-w-0 space-y-5">
          <CustomerGeneralSection customer={customer} />
          <LegalProfileCard
            customerId={customer.customerId}
            canRead={can(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.read)}
            canUpdate={can(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.update)}
          />
          <CreditProfileCard
            customerId={customer.customerId}
            canRead={can(CREDIT_PROFILE_PERMISSIONS.read)}
            canApprove={can(CREDIT_PROFILE_PERMISSIONS.approve)}
          />
          <CustomerSkusCard
            customerId={customer.customerId}
            canRead={can(VARIANT_PERMISSIONS.read)}
            canBlock={can(VARIANT_PERMISSIONS.update)}
            canApprove={can(VARIANT_PERMISSIONS.approve)}
          />
        </div>
        <div className="space-y-5">
          <CustomerActionCard customer={customer} can={can} onEdit={() => setEditOpen(true)} />
          <InvitationCard
            customerId={customer.customerId}
            canRead={canViewInvitation(can)}
            canResend={canResendInvitation(customer.status, can)}
          />
          <StatusHistoryCard customerId={customer.customerId} />
        </div>
      </div>
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
