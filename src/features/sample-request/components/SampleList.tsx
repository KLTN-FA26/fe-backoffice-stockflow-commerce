"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { FlaskConical, Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCTION_STATUS_BY_API,
  SAMPLE_API_STATUSES,
  SAMPLE_REQUEST_PERMISSIONS,
  SAMPLE_STATUS_BY_API,
  STORAGE_KEYS,
} from "@/constants";
import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate } from "@/lib/format/date";
import { useSamples } from "@/features/sample-request/queries";
import { sampleStatusLabel } from "@/features/sample-request/selectors";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, SAMPLE_COPY } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SampleRow } from "@/features/sample-request/types";

const STATUS_OPTIONS = SAMPLE_API_STATUSES.map((value) => ({
  value,
  label: sampleStatusLabel(value),
}));
const SORTABLE = new Set(["requestNumber", "status", "dueDate", "createdAt"]);

const COLUMNS: ColumnDef<SampleRow>[] = [
  {
    key: "requestNumber",
    header: "Mã yêu cầu",
    sortable: true,
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.sampleRequests.detail(row.id)}
        className={`text-accent font-medium hover:underline ${MONO}`}
        onClick={(event) => event.stopPropagation()}
      >
        {row.requestNumber}
      </Link>
    ),
  },
  {
    key: "round",
    header: "Lần",
    align: "right",
    cell: (row) => <span className={MONO}>{row.round}</span>,
  },
  { key: "customer", header: "Khách hàng", cell: (row) => <CustomerName id={row.customerId} /> },
  { key: "blankSku", header: "Phôi", cell: (row) => <span className={MONO}>{row.blankSku}</span> },
  {
    key: "quantity",
    header: "SL (cái)",
    align: "right",
    cell: (row) => <span className={MONO}>{row.quantity}</span>,
  },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    cell: (row) => <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[row.status]} />,
  },
  {
    key: "production",
    header: "LSX mẫu",
    cell: (row) =>
      row.productionOrder ? (
        <Link
          href={ADMIN_ROUTES.productionOrders.detail(row.productionOrder.id)}
          className={`text-accent hover:underline ${MONO}`}
          title={STATUS_LABEL_VI[PRODUCTION_STATUS_BY_API[row.productionOrder.status]]}
          onClick={(event) => event.stopPropagation()}
        >
          {row.productionOrder.orderNumber}
        </Link>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
  {
    key: "dueDate",
    header: "Cần trước",
    sortable: true,
    align: "right",
    cell: (row) => (
      <span className="text-ink-secondary tabular-nums">
        {row.dueDate ? formatDate(row.dueDate) : "—"}
      </span>
    ),
  },
];

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
