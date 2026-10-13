"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { FlaskConical, Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  SAMPLE_API_STATUSES,
  SAMPLE_REQUEST_PERMISSIONS,
  STORAGE_KEYS,
} from "@/constants";

import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useSamples } from "@/features/sample-request/queries";
import { sampleStatusLabel } from "@/features/sample-request/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import { SAMPLE_COPY } from "./copy";
import { STATUS_OPTIONS, SORTABLE, COLUMNS } from "./list-columns";

function SampleListContent() {
  const router = useRouter();
  const canRead = useCan(SAMPLE_REQUEST_PERMISSIONS.read);
  const canCreate = useCan(SAMPLE_REQUEST_PERMISSIONS.create);
  const list = useServerList(STORAGE_KEYS.adminSampleRequestsConfig, SAMPLE_API_STATUSES);
  const { filters } = list;
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [sortKey, sortDir] = filters.sort.split(",");
  const sortActive = SORTABLE.has(sortKey ?? "");
  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const query = useSamples(
    {
      page: list.apiPage,
      size: list.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
      customerId: customerId || undefined,
      sort: sortActive ? `${sortKey},${direction}` : undefined,
    },
    { enabled: canRead },
  );
  const hasFilters = list.hasBaseFilters || !!customerId;
  const clearAll = () => {
    filters.reset();
    void setCustomerId(null);
  };
  const createButton = canCreate ? (
    <Button asChild size="sm" className="rounded-[var(--r-sm)]">
      <Link
        href={
          customerId
            ? ADMIN_ROUTES.sampleRequests.createForCustomer(customerId)
            : ADMIN_ROUTES.sampleRequests.create
        }
      >
        <Plus className="size-3.5" /> Tạo yêu cầu mẫu
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={SAMPLE_COPY.pageTitle}
        subtitle="Làm mẫu in cho thiết kế mới — khách duyệt mẫu trước khi chấp nhận báo giá / sản xuất hàng loạt."
        actions={createButton}
      />
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(value) => void filters.setQ(value)}
          searchPlaceholder="Tìm theo mã yêu cầu (SR-…)"
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={filters.status}
          onToggleStatus={list.toggleStatus}
          onClearStatuses={() => void filters.setStatus([])}
          hasStatusFilter={filters.status.length > 0}
          summaryItems={[
            {
              label: "Search chính",
              value: filters.q.trim() ? `“${filters.q}”` : "Chưa dùng",
              active: filters.q.trim() !== "",
              onClear: () => void filters.setQ(""),
            },
            { label: "Trường search", value: "Mã yêu cầu" },
            {
              label: "Trạng thái",
              value: filters.status.map(sampleStatusLabel).join(", ") || "Tất cả",
              active: filters.status.length > 0,
              onClear: () => void filters.setStatus([]),
            },
            {
              label: "Khách hàng",
              value: customerId ? <CustomerName id={customerId} link={false} /> : "Tất cả",
              active: !!customerId,
              onClear: () => void setCustomerId(null),
            },
          ]}
          onResetAll={clearAll}
          resetDisabled={!hasFilters && !filters.sort}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.sampleRequests.detail(row.id))}
        flagRow={(row) => row.status === "CHANGES_REQUESTED" || row.status === "READY"}
        noun="yêu cầu mẫu"
        errorCopy={SAMPLE_COPY}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        empty={{
          icon: <FlaskConical className="size-8" />,
          title: "Chưa có yêu cầu mẫu",
          description: "Tạo yêu cầu mẫu từ dòng báo giá cần duyệt mẫu hoặc từ hồ sơ khách hàng.",
          action: createButton,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        sorting={{
          key: sortActive ? (sortKey ?? null) : null,
          direction,
          onChange: (key, dir) => {
            if (!SORTABLE.has(key)) return;
            void filters.setSort(`${key},${dir}`);
            void filters.setPage(1);
          },
        }}
      />
    </>
  );
}

export function SampleList() {
  return (
    <PermissionBoundary permissions={[SAMPLE_REQUEST_PERMISSIONS.viewPage]} variant="list">
      <SampleListContent />
    </PermissionBoundary>
  );
}
