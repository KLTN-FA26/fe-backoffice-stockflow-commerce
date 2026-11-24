"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Landmark } from "lucide-react";

import { PAYMENT_LIST_LABELS as LL, RECEIVABLES_LABELS as L } from "@/constants/labels-payment";
import {
  PAYMENT_ROUTES,
  PAYMENT_STORAGE_KEYS,
  RECEIVABLES_REPORT_PERMISSIONS,
} from "@/constants/payment";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedList } from "@/hooks/use-paged-list";
import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useReceivables } from "../queries";

import { MONO } from "./copy";
import { DebtReconciliationAction } from "./DebtReconciliationAction";
import { DateCell, MoneyCell } from "./primitives";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Receivable } from "../types";

const NO_SORT = new Set<string>();
const COPY: LoadErrorCopy = {
  pageTitle: L.pageTitle,
  notFoundTitle: L.notFoundTitle,
  notFoundDescription: L.notFoundDescription,
  forbiddenDescription: L.forbiddenDescription,
  noReadDescription: L.noReadDescription,
};

/** Tiền một ô; 0 hiện mờ để mắt dừng ở ô có nợ. */
function Amount({ value }: { value: number }) {
  return value > 0 ? (
    <MoneyCell amount={value} currency="VND" />
  ) : (
    <span className={`text-ink-tertiary ${MONO}`}>0</span>
  );
}

const COLUMNS: ColumnDef<Receivable>[] = [
  {
    key: "customer",
    header: L.customer,
    cell: (row) => (
      <Link
        href={PAYMENT_ROUTES.installments.owingByCustomer(row.customerId)}
        className="flex flex-col hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-accent-text font-medium">{row.customerName ?? L.customer}</span>
        {(row.customerCode || row.taxCode) && (
          <span className="text-ink-tertiary text-xs">
            {[row.customerCode, row.taxCode && `${L.taxCode} ${row.taxCode}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </Link>
    ),
  },
  { key: "owed", header: L.owed, align: "right", cell: (row) => <Amount value={row.owed} /> },
  {
    key: "overdue",
    header: L.overdue,
    align: "right",
    cell: (row) => <Amount value={row.overdue} />,
  },
  {
    // Đợt thu khi ký đã quá hạn: không nằm trong "Còn phải thu" / "Quá hạn" (docs 15 §4.3) nhưng kiểm tra tín dụng của
    // hợp đồng mới tính là quá hạn — hiện riêng để khách đó không trông như sạch nợ.
    key: "signingOverdue",
    header: L.signingOverdue,
    align: "right",
    cell: (row) => <Amount value={row.signingOverdue} />,
  },
  {
    key: "oldestDueOn",
    header: L.oldestDue,
    align: "right",
    cell: (row) => <DateCell iso={row.oldestDueOn} />,
  },
  {
    key: "d0to30",
    header: L.d0to30,
    align: "right",
    cell: (row) => <Amount value={row.aging?.d0to30 ?? 0} />,
  },
  {
    key: "d31to60",
    header: L.d31to60,
    align: "right",
    cell: (row) => <Amount value={row.aging?.d31to60 ?? 0} />,
  },
  {
    key: "over60",
    header: L.over60,
    align: "right",
    cell: (row) => <Amount value={row.aging?.over60 ?? 0} />,
  },
  {
    key: "installmentCount",
    header: L.installmentCount,
    align: "right",
    cell: (row) => <span className={MONO}>{row.installmentCount ?? "—"}</span>,
  },
  {
    // BE feat/business-documents #6: biên bản đối chiếu công nợ của khách, chọn kỳ (nút tự ẩn khi thiếu quyền)
    key: "reconciliation",
    header: L.reconciliation,
    cell: (row) => (
      <DebtReconciliationAction
        customerId={row.customerId}
        customerName={row.customerName ?? row.customerCode ?? L.customer}
      />
    ),
  },
];

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
          summaryItems={[
            {
              label: LL.searchMain,
              value: search.trim() ? `“${search}”` : LL.notUsed,
              active: search.trim() !== "",
              onClear: () => void setSearch(""),
            },
          ]}
          onResetAll={() => {
            void setSearch("");
            paged.resetPage();
          }}
          resetDisabled={!search.trim()}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={COLUMNS}
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
 * dòng — còn nợ, quá hạn, đợt thu khi ký quá hạn, hạn cũ nhất, tuổi nợ 0–30 / 31–60 / > 60 ngày; quá hạn nhiều nhất
 * trước (BE sắp theo quá hạn + đợt ký quá hạn). Bấm khách → các đợt còn nợ của khách. Máy chủ chưa có endpoint →
 * chuyển sang danh sách đợt `owing=true` như trước.
 */
export function ReceivablesList() {
  return (
    <PermissionBoundary permissions={[RECEIVABLES_REPORT_PERMISSIONS.viewPage]} variant="list">
      <ReceivablesContent />
    </PermissionBoundary>
  );
}
