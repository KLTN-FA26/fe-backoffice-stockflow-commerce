"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";

import {
  ADMIN_ROUTES,
  CUSTOMER_API_STATUSES,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_STATUS_BY_API,
  STORAGE_KEYS,
} from "@/constants";

import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import { useCustomers } from "@/features/customer/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { CUSTOMER_COPY } from "./copy";
import { STATUS_OPTIONS, COLUMNS, SORTABLE } from "./list-columns";

import type { CustomerApiStatus } from "@/constants";

function CustomerListContent() {
  const router = useRouter();
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const canCreate = useCan(CUSTOMER_PERMISSIONS.create);
  const list = useServerList(STORAGE_KEYS.adminCustomersConfig, CUSTOMER_API_STATUSES);
  const { filters } = list;
  // BE nhận MỘT trạng thái (CustomerStatus.valueOf) → lọc trạng thái chọn đơn.
  const status: CustomerApiStatus | undefined = filters.status[0];
  const [sortKey, sortDir] = filters.sort.split(",");
  const sort = SORTABLE.has(sortKey ?? "")
    ? { key: sortKey ?? null, direction: sortDir === "asc" ? ("asc" as const) : ("desc" as const) }
    : { key: null, direction: "desc" as const };
  const query = useCustomers(
    {
      page: list.apiPage,
      size: list.pageSize,
      q: filters.debouncedQ,
      status,
      sort: sort.key ? `${sort.key},${sort.direction}` : undefined,
    },
    { enabled: canRead },
  );

  const createButton = canCreate ? (
    <Button asChild size="sm" className="rounded-[var(--r-sm)]">
      <Link href={ADMIN_ROUTES.customers.create}>
        <Plus className="size-3.5" /> Tạo khách hàng
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={CUSTOMER_COPY.pageTitle}
        subtitle="Khách doanh nghiệp do Sales tạo — mời kích hoạt portal, theo dõi trạng thái tài khoản."
        actions={createButton}
      />
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(value) => void filters.setQ(value)}
          searchPlaceholder="Tìm theo tên, email, SĐT (+84…) hoặc MST"
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={filters.status}
          onToggleStatus={(value) => void filters.setStatus(status === value ? [] : [value])}
          onClearStatuses={() => void filters.setStatus([])}
          hasStatusFilter={filters.status.length > 0}
          summaryItems={[
            {
              label: "Search chính",
              value: filters.q.trim() ? `“${filters.q}”` : "Chưa dùng",
              active: filters.q.trim() !== "",
              onClear: () => void filters.setQ(""),
            },
            { label: "Trường search", value: "Tên · Email · SĐT · MST" },
            {
              label: "Trạng thái",
              value: status
                ? (STATUS_LABEL_VI[CUSTOMER_STATUS_BY_API[status]] ?? status)
                : "Tất cả",
              active: !!status,
              onClear: () => void filters.setStatus([]),
            },
          ]}
          onResetAll={() => filters.reset()}
          resetDisabled={!list.hasBaseFilters && !filters.sort}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={COLUMNS}
        rowKey={(row) => row.customerId}
        onRowClick={(row) => router.push(ADMIN_ROUTES.customers.detail(row.customerId))}
        flagRow={(row) => row.status === "PENDING_ACTIVATION"}
        noun="khách hàng"
        errorCopy={CUSTOMER_COPY}
        hasFilters={list.hasBaseFilters}
        onClearFilters={() => filters.reset()}
        empty={{
          icon: <Users className="size-8" />,
          title: "Chưa có khách hàng",
          description: "Sales tạo khách doanh nghiệp và gửi lời mời kích hoạt portal.",
          action: createButton,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
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
    </>
  );
}

export function CustomerList() {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PERMISSIONS.viewPage]} variant="list">
      <CustomerListContent />
    </PermissionBoundary>
  );
}
