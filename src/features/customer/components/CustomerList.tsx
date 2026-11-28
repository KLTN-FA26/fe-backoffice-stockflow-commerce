"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";

import {
  ADMIN_ROUTES,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  QUOTE_PERMISSIONS,
  STORAGE_KEYS,
} from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useCreditPositions, useCustomers, useSalesContacts } from "@/features/customer/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { TOOLBAR_PRIMARY_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { CUSTOMER_COPY } from "./copy";
import { customerHeaderFilters } from "./customer-header-filters";
import { CustomerListToolbar } from "./CustomerListToolbar";
import {
  buildCustomerColumns,
  CUSTOMER_COLUMNS,
  CUSTOMER_LOCKED_COLUMNS,
  SORTABLE,
  unavailableCustomerColumns,
} from "./list-columns";
import { useCustomerListFilters } from "./useCustomerListFilters";
import { useCustomerOwners } from "./useCustomerOwners";

function CustomerListContent() {
  const router = useRouter();
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const canCreate = useCan(CUSTOMER_PERMISSIONS.create);
  const readQuote = useCan(QUOTE_PERMISSIONS.read);
  const createQuote = useCan(QUOTE_PERMISSIONS.create);
  const state = useCustomerListFilters();
  const { list, filters } = state;
  const [sortKey, sortDir] = filters.sort.split(",");
  const sort = SORTABLE.has(sortKey ?? "")
    ? { key: sortKey ?? null, direction: sortDir === "asc" ? ("asc" as const) : ("desc" as const) }
    : { key: null, direction: "desc" as const };
  const query = useCustomers(
    {
      page: list.apiPage,
      size: list.pageSize,
      q: state.serverQ,
      status: state.status,
      sort: sort.key ? `${sort.key},${sort.direction}` : undefined,
      ...state.ownerParams,
      ...(state.taxCodeMissing ? { taxCodeMissing: true } : {}),
    },
    { enabled: canRead },
  );
  const { canRead: canReadOwner, sales } = useCustomerOwners();
  // D41: BE cũ không gửi `taxCodeMissing` → không có cờ, không có lọc (đang lọc thì giữ công tắc để tắt được)
  const taxCodeFlag =
    state.taxCodeMissing ||
    (query.data?.items ?? []).some((row) => typeof row.taxCodeMissing === "boolean");
  // bo-29: hạn mức / dư nợ và sale liên hệ gần nhất — mỗi thứ MỘT lần gọi cho id của trang đang xem. Không có quyền đọc
  // hạn mức → không gọi, không có cột (BE cũng trả 403); BE chưa có endpoint → `null`, cũng không có cột.
  const canReadCredit = useCan(CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read);
  const pageIds = (query.data?.items ?? []).map((row) => row.customerId);
  const creditPositions = useCreditPositions(pageIds, canRead && canReadCredit);
  const salesContacts = useSalesContacts(pageIds, canRead);
  const extras = {
    creditPositions: canReadCredit ? creditPositions.data : null,
    salesContacts: salesContacts.data,
    salesOwners: canReadOwner,
  };
  const unavailable = unavailableCustomerColumns(extras);
  const columnState = useColumnVisibility(STORAGE_KEYS.adminCustomersColumns, CUSTOMER_COLUMNS, {
    locked: CUSTOMER_LOCKED_COLUMNS,
  });
  const columns = withHeaderFilters(
    buildCustomerColumns({ readQuote, createQuote }, extras).filter((column) =>
      columnState.visible.some((key) => key === column.key),
    ),
    customerHeaderFilters(state, sales),
  );

  return (
    // Trang danh sách kiểu Vercel (backoffice-erp-ui A): không tiêu đề hiển thị — tên trang ở breadcrumb; h1 cho
    // screen reader. Nút tạo mới nằm trên thanh breadcrumb.
    <div className="surface-soft">
      <h1 className="sr-only">{CUSTOMER_COPY.pageTitle}</h1>
      <HeaderActions>
        <HeaderCreateButton
          onClick={() => canCreate && router.push(ADMIN_ROUTES.customers.create)}
          disabled={!canCreate}
          aria-label="Tạo mới khách hàng"
          tooltip={canCreate ? "Tạo khách hàng" : PERMISSION_UI.customerCreateDenied}
        />
      </HeaderActions>
      {canRead && (
        <CustomerListToolbar
          filters={state}
          columns={columnState}
          unavailable={unavailable}
          owners={canReadOwner ? { sales } : undefined}
          taxCodeFlag={taxCodeFlag}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.customerId}
        onRowClick={(row) => router.push(ADMIN_ROUTES.customers.detail(row.customerId))}
        flagRow={(row) => row.status === "PENDING_ACTIVATION"}
        noun="khách hàng"
        errorCopy={CUSTOMER_COPY}
        hasFilters={state.hasFilters}
        onClearFilters={state.clear}
        rowFilter={{ active: state.hasColumnFilters, match: state.matches }}
        empty={{
          icon: <Users className="size-8" />,
          title: "Chưa có khách hàng",
          description: "Sales tạo khách doanh nghiệp và gửi lời mời kích hoạt portal.",
          action: canCreate ? (
            <Button asChild size="sm" className={TOOLBAR_PRIMARY_CLASS}>
              <Link href={ADMIN_ROUTES.customers.create}>
                <Plus className="size-3.5" /> Tạo khách hàng đầu tiên
              </Link>
            </Button>
          ) : undefined,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
        emptyInTable
        sorting={{
          key: sort.key,
          direction: sort.direction,
          onChange: (key, direction) => {
            if (!SORTABLE.has(key)) return;
            void filters.setSort(`${key},${direction}`);
            void filters.setPage(1);
          },
        }}
      />
    </div>
  );
}

export function CustomerList() {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage]} variant="list">
      <CustomerListContent />
    </PermissionBoundary>
  );
}
