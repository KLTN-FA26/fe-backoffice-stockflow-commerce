"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2, FileText, FlaskConical, Pencil } from "lucide-react";

import {
  ADMIN_ROUTES,
  CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_STATUS_BY_API,
  QUOTE_PERMISSIONS,
  SAMPLE_REQUEST_PERMISSIONS,
} from "@/constants";
import { useCan, useMyPermissions, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  canChangeCustomerStatus,
  canResendInvitation,
  canViewInvitation,
} from "@/features/customer/lifecycle";
import { useCustomer } from "@/features/customer/queries";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { CUSTOMER_COPY } from "./copy";
import { CreditProfileCard } from "./detail/CreditProfileCard";
import { CustomerEditDialog } from "./detail/CustomerEditDialog";
import { CustomerStatusActions } from "./detail/CustomerStatusActions";
import { InfoList } from "./detail/InfoList";
import { InvitationCard } from "./detail/InvitationCard";
import { StatusHistoryCard } from "./detail/StatusHistoryCard";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

function CustomerDetailContent({ id }: { id: string }) {
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const can = usePermissionChecker();
  const roles = useMyPermissions().data?.roles ?? [];
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
  const active = customer.status === "ACTIVE";

  return (
    <>
      <PageHeader
        title={customer.fullName}
        subtitle={customer.email}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={ADMIN_ROUTES.customers.list}>
                <ArrowLeft className="size-3.5" /> Danh sách
              </Link>
            </Button>
            {can(CUSTOMER_PERMISSIONS.update) && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" /> Sửa
              </Button>
            )}
            <CustomerStatusActions
              customer={customer}
              canChangeStatus={canChangeCustomerStatus(can, roles)}
            />
            {active && can(QUOTE_PERMISSIONS.create) && (
              <Button asChild size="sm">
                <Link href={ADMIN_ROUTES.quotes.createForCustomer(customer.customerId)}>
                  <FilePlus2 className="size-3.5" /> Tạo báo giá
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-ink-primary text-sm font-semibold">Hồ sơ</h2>
            <StatusDot domain="customer" status={CUSTOMER_STATUS_BY_API[customer.status]} />
          </div>
          <InfoList
            items={[
              { label: "Email", value: <span className="break-all">{customer.email}</span> },
              { label: "Điện thoại", value: <span className={MONO}>{customer.phone ?? "—"}</span> },
              {
                label: "Mã số thuế",
                value: customer.taxCode ? (
                  <span className={MONO}>{customer.taxCode}</span>
                ) : (
                  "Chưa có"
                ),
              },
              { label: "Ngày tạo", value: formatDateTime(customer.createdAt) },
            ]}
          />
          <div className="border-border-default flex flex-wrap gap-2 border-t pt-3">
            {can(QUOTE_PERMISSIONS.read) && (
              <Button asChild variant="outline" size="sm">
                <Link href={ADMIN_ROUTES.quotes.byCustomer(customer.customerId)}>
                  <FileText className="size-3.5" /> Báo giá của khách
                </Link>
              </Button>
            )}
            {active && can(SAMPLE_REQUEST_PERMISSIONS.create) && (
              <Button asChild variant="outline" size="sm">
                <Link href={ADMIN_ROUTES.sampleRequests.createForCustomer(customer.customerId)}>
                  <FlaskConical className="size-3.5" /> Tạo yêu cầu mẫu
                </Link>
              </Button>
            )}
            {can(SAMPLE_REQUEST_PERMISSIONS.read) && (
              <Button asChild variant="outline" size="sm">
                <Link href={ADMIN_ROUTES.sampleRequests.byCustomer(customer.customerId)}>
                  <FlaskConical className="size-3.5" /> Yêu cầu mẫu
                </Link>
              </Button>
            )}
          </div>
        </Card>
        <InvitationCard
          customerId={customer.customerId}
          canRead={canViewInvitation(roles)}
          canResend={canResendInvitation(customer.status, can)}
        />
        <CreditProfileCard
          customerId={customer.customerId}
          canRead={can(CREDIT_PROFILE_PERMISSIONS.read)}
        />
        <StatusHistoryCard customerId={customer.customerId} />
      </div>
      <CustomerEditDialog customer={customer} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage]}>
      <CustomerDetailContent id={id} />
    </PermissionBoundary>
  );
}
