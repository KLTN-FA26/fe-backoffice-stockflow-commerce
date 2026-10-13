"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { FileSignature, Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  PAYMENT_TERM_LABELS,
  QUOTE_API_STATUSES,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_BY_API,
  STORAGE_KEYS,
} from "@/constants";
import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate } from "@/lib/format/date";
import { useQuotes } from "@/features/quote/queries";
import { isExpired } from "@/features/quote/selectors";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO, QUOTE_COPY, quoteStatusLabel } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { QuoteRow } from "@/features/quote/types";

const STATUS_OPTIONS = QUOTE_API_STATUSES.map((value) => ({
  value,
  label: quoteStatusLabel(value),
}));
const SORTABLE = new Set(["quoteNumber", "status", "validUntil", "createdAt"]);

const COLUMNS: ColumnDef<QuoteRow>[] = [
  {
    key: "quoteNumber",
    header: "Số báo giá",
    sortable: true,
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.quotes.detail(row.id)}
        className={`text-accent font-medium hover:underline ${MONO}`}
        onClick={(event) => event.stopPropagation()}
      >
        {row.quoteNumber}
      </Link>
    ),
  },
  { key: "customer", header: "Khách hàng", cell: (row) => <CustomerName id={row.customerId} /> },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    cell: (row) => <StatusDot domain="order" status={QUOTE_STATUS_BY_API[row.status]} />,
  },
  {
    key: "revision",
    header: "Bản",
    align: "right",
    cell: (row) => <span className={MONO}>{row.revision}</span>,
  },
  {
    key: "paymentTerm",
    header: "Thanh toán",
    cell: (row) => (
      <span className="text-ink-secondary">{PAYMENT_TERM_LABELS[row.paymentTerm]}</span>
    ),
  },
  {
    key: "validUntil",
    header: "Hiệu lực đến",
    sortable: true,
    align: "right",
    cell: (row) => (
      <span
        className={`tabular-nums ${row.status === "SENT" && isExpired(row.validUntil) ? "text-danger" : "text-ink-secondary"}`}
      >
        {formatDate(row.validUntil)}
      </span>
    ),
  },
  {
    key: "order",
    header: "Đơn bán",
    cell: (row) =>
      row.convertedOrderId ? (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.convertedOrderId)}
          className="text-accent hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Xem đơn
        </Link>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];

function QuoteListContent() {
  const router = useRouter();
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const canCreate = useCan(QUOTE_PERMISSIONS.create);
  const list = useServerList(STORAGE_KEYS.adminQuotesConfig, QUOTE_API_STATUSES);
  const { filters } = list;
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [sortKey, sortDir] = filters.sort.split(",");
  const sortActive = SORTABLE.has(sortKey ?? "");
  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const query = useQuotes(
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
  const createHref = customerId
    ? ADMIN_ROUTES.quotes.createForCustomer(customerId)
    : ADMIN_ROUTES.quotes.create;
  const createButton = canCreate ? (
    <Button asChild size="sm" className="rounded-[var(--r-sm)]">
      <Link href={createHref}>
        <Plus className="size-3.5" /> Tạo báo giá
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={QUOTE_COPY.pageTitle}
        subtitle="Báo giá bậc thang cho khách B2B — gửi khách duyệt trên portal, chấp nhận rồi chuyển thành đơn bán."
        actions={createButton}
      />
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(value) => void filters.setQ(value)}
          searchPlaceholder="Tìm theo số báo giá (QT-…)"
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
            { label: "Trường search", value: "Số báo giá" },
            {
              label: "Trạng thái",
              value: filters.status.map(quoteStatusLabel).join(", ") || "Tất cả",
              active: filters.status.length > 0,
              onClear: () => void filters.setStatus([]),
            },
            {
              label: "Khách hàng",
              value: customerId ? <CustomerName id={customerId} link={false} /> : "Tất cả",
              active: !!customerId,
              onClear: () => {
                void setCustomerId(null);
                void filters.setPage(1);
              },
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
        onRowClick={(row) => router.push(ADMIN_ROUTES.quotes.detail(row.id))}
        flagRow={(row) => row.status === "CHANGES_REQUESTED" || row.status === "ACCEPTED"}
        noun="báo giá"
        errorCopy={QUOTE_COPY}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        empty={{
          icon: <FileSignature className="size-8" />,
          title: "Chưa có báo giá",
          description: "Tạo báo giá nháp từ hồ sơ khách hàng hoặc nút Tạo báo giá.",
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

export function QuoteList() {
  return (
    <PermissionBoundary permissions={[QUOTE_PERMISSIONS.viewPage]} variant="list">
      <QuoteListContent />
    </PermissionBoundary>
  );
}
