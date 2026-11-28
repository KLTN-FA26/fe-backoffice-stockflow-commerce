"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Landmark } from "lucide-react";

import { PAYMENT_LIST_LABELS as LL, RECEIVABLES_LABELS as L } from "@/constants/labels-payment";
import {
  PAYMENT_ROUTES,
  PAYMENT_STORAGE_KEYS,
  RECEIVABLES_REPORT_PERMISSIONS,
} from "@/constants/payment";
import {
  columnSummaryItem,
  columnToolbarProps,
  useColumnVisibility,
} from "@/hooks/use-column-visibility";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedList } from "@/hooks/use-paged-list";
import { ApiError } from "@/lib/api/error";
import { formatMoney } from "@/lib/format/money";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatCell, StatStrip } from "@/components/shared/StatStrip";

import { useReceivables } from "../queries";

import {
  RECEIVABLE_COLUMN_DEFS,
  RECEIVABLE_COLUMN_LABELS,
  RECEIVABLE_COLUMNS,
  RECEIVABLE_DEFAULT_COLUMNS,
  RECEIVABLE_LOCKED_COLUMNS,
} from "./receivable-columns";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { ReceivableTotals } from "../types";

const NO_SORT = new Set<string>();
const COPY: LoadErrorCopy = {
  pageTitle: L.pageTitle,
  notFoundTitle: L.notFoundTitle,
  notFoundDescription: L.notFoundDescription,
  forbiddenDescription: L.forbiddenDescription,
  noReadDescription: L.noReadDescription,
};

/**
 * Dải tổng (bo-23): tổng các cột trên MỌI khách khớp bộ lọc — BE `totals`, không cộng trang đang xem. Một dải mỗi tiền
 * tệ. `DataTable` chưa có dòng chân bảng nên tổng nằm ngay trên bảng, cùng thứ tự cột.
 */
function ReceivableTotalsStrip({ totals }: { totals: readonly ReceivableTotals[] }) {
  if (totals.length === 0) return null;
  return (
    <section aria-label={L.totalsLabel} className="mb-3 space-y-2">
      {totals.map((t) => {
        const money = (amount: number) => formatMoney(amount, t.currency);
        return (
          <StatStrip key={t.currency} columns="grid-cols-3 lg:grid-cols-6">
            <StatCell
              label={`${L.owed} · ${L.totalsTitle(t.customers)}`}
              value={money(t.owed)}
              mono
            />
            <StatCell label={L.overdue} value={money(t.overdue)} mono />
            <StatCell label={L.signingOverdue} value={money(t.signingOverdue)} mono />
            <StatCell label={L.d0to30} value={money(t.aging.d0to30)} mono />
            <StatCell label={L.d31to60} value={money(t.aging.d31to60)} mono />
            <StatCell label={L.over60} value={money(t.aging.over60)} mono />
          </StatStrip>
        );
      })}
    </section>
  );
}

/** BE chưa có `GET /reports/receivables` → 404 (hoặc 405). */
function endpointMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

function ReceivablesContent() {
  const router = useRouter();
  const canRead = useCan(RECEIVABLES_REPORT_PERMISSIONS.read);
  const paged = usePagedList(PAYMENT_STORAGE_KEYS.receivablesConfig, NO_SORT);
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const debounced = useDebouncedValue(search, 300);
  const query = useReceivables(
    { page: paged.apiPage, size: paged.pageSize, search: debounced.trim() || undefined },
    { enabled: canRead },
  );
  const columnState = useColumnVisibility(
    PAYMENT_STORAGE_KEYS.receivablesColumns,
    RECEIVABLE_COLUMNS,
    { defaults: RECEIVABLE_DEFAULT_COLUMNS, locked: RECEIVABLE_LOCKED_COLUMNS },
  );
  const columns = RECEIVABLE_COLUMN_DEFS.filter((column) =>
    columnState.visible.some((key) => key === column.key),
  );
  const missing = query.isError && endpointMissing(query.error);
  // R5-11 chưa có trên máy chủ: lùi về cách xem cũ — danh sách đợt lọc "Công nợ phải thu" (owing=true, BE-5).
  useEffect(() => {
    if (missing) router.replace(PAYMENT_ROUTES.installments.receivables);
  }, [missing, router]);
  if (missing) return <PageSkeleton variant="list" />;

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        <ListToolbar
          search={search}
          onSearchChange={(value) => {
            void setSearch(value);
            paged.resetPage();
          }}
          searchPlaceholder={L.searchPlaceholder}
          {...columnToolbarProps(columnState, RECEIVABLE_COLUMN_LABELS, RECEIVABLE_COLUMNS)}
          summaryItems={[
            {
              label: LL.searchMain,
              value: search.trim() ? `“${search}”` : LL.notUsed,
              active: search.trim() !== "",
              onClear: () => void setSearch(""),
            },
            columnSummaryItem(columnState),
          ]}
          onResetAll={() => {
            void setSearch("");
            columnState.reset();
            paged.resetPage();
          }}
          resetDisabled={!search.trim() && !columnState.hasColumnConfig}
        />
      )}
      {query.data && <ReceivableTotalsStrip totals={query.data.totals} />}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.customerId}
        // Bấm dòng = xem các đợt còn nợ của khách đó (drill-down)
        onRowClick={(row) =>
          router.push(PAYMENT_ROUTES.installments.owingByCustomer(row.customerId))
        }
        // Như thứ tự của BE: quá hạn gồm cả đợt thu khi ký đã quá hạn
        flagRow={(row) => row.overdue + row.signingOverdue > 0}
        noun="khách còn nợ"
        errorCopy={COPY}
        hasFilters={!!search.trim()}
        onClearFilters={() => void setSearch("")}
        empty={{
          icon: <Landmark className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/**
 * Công nợ phải thu theo khách (BO-UX-37, BE `GET /reports/receivables`, quyền `reporting-receivables`): mỗi khách một
 * dòng — còn nợ, quá hạn, đợt thu khi ký quá hạn, tuổi nợ 0–30 / 31–60 / > 60 ngày, hạn mức và % đã dùng (hạn cũ
 * nhất, số đợt bật qua Ẩn hiện cột); quá hạn nhiều nhất trước (BE sắp theo quá hạn + đợt ký quá hạn); dải tổng trên mọi
 * khách đang lọc. Bấm khách → các đợt còn nợ của khách. Máy chủ chưa có endpoint → chuyển sang danh sách đợt
 * `owing=true` như trước.
 */
export function ReceivablesList() {
  return (
    <PermissionBoundary permissions={[RECEIVABLES_REPORT_PERMISSIONS.viewPage]} variant="list">
      <ReceivablesContent />
    </PermissionBoundary>
  );
}
