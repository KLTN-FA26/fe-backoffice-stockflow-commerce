"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "cn";
import { FileSignature, Plus } from "lucide-react";

import { ADMIN_ROUTES, QUOTE_API_STATUSES, QUOTE_PERMISSIONS, STORAGE_KEYS } from "@/constants";

import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useQuotes } from "@/features/quote/queries";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import {
  ListToolbar,
  TOOLBAR_ACTION_CLASS,
  TOOLBAR_PRIMARY_CLASS,
} from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { QUOTE_COPY, quoteStatusLabel } from "./copy";
import { STATUS_OPTIONS, SORTABLE, COLUMNS } from "./list-columns";

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
    <Button asChild size="sm" className={cn(TOOLBAR_PRIMARY_CLASS, TOOLBAR_ACTION_CLASS)}>
      <Link href={createHref}>
        <Plus className="size-3.5" /> Tạo báo giá
      </Link>
    </Button>
  ) : undefined;

  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // tên trang nằm ở breadcrumb topbar; h1 giữ cho screen reader.
    <div className="surface-soft">
      <h1 className="sr-only">{QUOTE_COPY.pageTitle}</h1>
      {canRead ? (
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
          actions={createButton}
        />
      ) : (
        createButton && <div className="mb-3 flex justify-end">{createButton}</div>
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
        stickyHeader
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
    </div>
  );
}

export function QuoteList() {
  return (
    <PermissionBoundary permissions={[QUOTE_PERMISSIONS.viewPage]} variant="list">
      <QuoteListContent />
    </PermissionBoundary>
  );
}
