"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignature, Hourglass, Plus } from "lucide-react";

import { ADMIN_ROUTES, QUOTE_PERMISSIONS, STORAGE_KEYS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useQuotes, useQuoteStatusCounts } from "@/features/quote/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { TOOLBAR_PRIMARY_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { QUOTE_COPY, QUOTE_PRICE_REVIEW_QUEUE_EMPTY } from "./copy";
import { buildQuoteColumns, QUOTE_COLUMNS, QUOTE_LOCKED_COLUMNS, SORTABLE } from "./list-columns";
import { quoteHeaderFilters } from "./quote-header-filters";
import { quoteActionsColumn } from "./quote-row-actions";
import { QuoteListToolbar } from "./QuoteListToolbar";
import { QuoteStatusTabs } from "./QuoteStatusTabs";
import { useQuoteListFilters } from "./useQuoteListFilters";

function QuoteListContent() {
  const router = useRouter();
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const canCreate = useCan(QUOTE_PERMISSIONS.create);
  const state = useQuoteListFilters();
  const { list, filters, customerId } = state;
  const [sortKey, sortDir] = filters.sort.split(",");
  const sortActive = SORTABLE.has(sortKey ?? "");
  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const query = useQuotes(
    {
      page: list.apiPage,
      size: list.pageSize,
      search: state.serverSearch,
      status: filters.status,
      customerId: customerId || undefined,
      sort: sortActive ? `${sortKey},${direction}` : undefined,
      priceReview: state.priceReview.value,
    },
    { enabled: canRead },
  );
  // bo-06: số trên tab — cùng tìm kiếm / khách của danh sách, KHÔNG kèm trạng thái / duyệt giá (chính tab đổi hai lọc đó;
  // kèm vào thì mọi tab khác thành 0).
  const counts = useQuoteStatusCounts(
    { search: state.serverSearch, customerId: customerId || undefined },
    canRead,
  );
  const columnState = useColumnVisibility(STORAGE_KEYS.adminQuotesColumns, QUOTE_COLUMNS, {
    locked: QUOTE_LOCKED_COLUMNS,
  });
  // R5-2: BE chưa trả `total` cho dòng nào của trang → không có cột "Tổng có thuế" (không hiện cột toàn "—").
  const showTotal = query.data?.items.some((row) => row.total != null) ?? false;
  const columns = withHeaderFilters(
    [...buildQuoteColumns(showTotal), quoteActionsColumn()].filter((column) =>
      columnState.visible.some((key) => key === column.key),
    ),
    quoteHeaderFilters(state),
  );
  const createHref = customerId
    ? ADMIN_ROUTES.quotes.createForCustomer(customerId)
    : ADMIN_ROUTES.quotes.create;

  return (
    // Trang danh sách kiểu Vercel (backoffice-erp-ui A): không tiêu đề hiển thị — tên trang ở breadcrumb; h1 cho
    // screen reader. Nút tạo mới nằm trên thanh breadcrumb.
    <div className="surface-soft">
      <h1 className="sr-only">{QUOTE_COPY.pageTitle}</h1>
      <HeaderActions>
        <HeaderCreateButton
          onClick={() => canCreate && router.push(createHref)}
          disabled={!canCreate}
          aria-label="Tạo mới báo giá"
          tooltip={canCreate ? "Tạo báo giá" : PERMISSION_UI.quoteCreateDenied}
        />
      </HeaderActions>
      {canRead && <QuoteStatusTabs state={state} counts={counts.data} />}
      {canRead && <QuoteListToolbar state={state} columns={columnState} />}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.quotes.detail(row.id))}
        flagRow={(row) =>
          row.status === "CHANGES_REQUESTED" || row.status === "ACCEPTED" || row.priceReviewPending
        }
        noun="báo giá"
        errorCopy={QUOTE_COPY}
        // Hàng chờ "Chờ duyệt giá" rỗng là "không có gì chờ", không phải "không khớp từ khoá" (bo-14).
        hasFilters={state.hasFilters && !state.queueOnly}
        onClearFilters={state.clear}
        rowFilter={state.rowFilter}
        empty={
          state.queueOnly
            ? { icon: <Hourglass className="size-8" />, ...QUOTE_PRICE_REVIEW_QUEUE_EMPTY }
            : {
                icon: <FileSignature className="size-8" />,
                title: "Chưa có báo giá",
                description: "Tạo báo giá nháp từ hồ sơ khách hàng hoặc nút Tạo mới.",
                action: canCreate ? (
                  <Button asChild size="sm" className={TOOLBAR_PRIMARY_CLASS}>
                    <Link href={createHref}>
                      <Plus className="size-3.5" /> Tạo báo giá đầu tiên
                    </Link>
                  </Button>
                ) : undefined,
              }
        }
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
        emptyInTable
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
