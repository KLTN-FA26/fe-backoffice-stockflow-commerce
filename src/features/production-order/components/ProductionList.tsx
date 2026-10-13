"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Factory } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCTION_API_STATUSES,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_ORDER_TYPES,
  STORAGE_KEYS,
} from "@/constants";
import { useServerList } from "@/hooks/use-server-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { useProductionOrders } from "@/features/production-order/queries";
import { isOverdue, productionStatusLabel, todayVn } from "@/features/production-order/selectors";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { MONO, PRODUCTION_COPY, ProductionStatus, TYPE_LABEL } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ProductionRow } from "@/features/production-order/types";

const STATUS_OPTIONS = PRODUCTION_API_STATUSES.map((value) => ({
  value,
  label: productionStatusLabel(value),
}));
const SORTABLE = new Set(["orderNumber", "status", "dueDate", "createdAt"]);

function columns(today: string): ColumnDef<ProductionRow>[] {
  return [
    {
      key: "orderNumber",
      header: "Số LSX",
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.productionOrders.detail(row.id)}
          className={`text-accent font-medium hover:underline ${MONO}`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Loại",
      cell: (row) => <span className="text-ink-secondary">{TYPE_LABEL[row.type]}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      sortable: true,
      cell: (row) => <ProductionStatus row={row} />,
    },
    {
      key: "blankSku",
      header: "Phôi",
      cell: (row) => <span className={MONO}>{row.blankSku}</span>,
    },
    {
      key: "qty",
      header: "Đạt / KH (cái)",
      align: "right",
      cell: (row) => (
        <span className={MONO}>
          {formatNumber(row.goodQuantity)} / {formatNumber(row.plannedQuantity)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Hạn giao",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span
          className={`tabular-nums ${isOverdue(row, today) ? "text-danger font-medium" : "text-ink-secondary"}`}
        >
          {row.dueDate ? formatDate(row.dueDate) : "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Nguồn",
      cell: (row) =>
        row.sampleRequestId ? (
          <Link
            href={ADMIN_ROUTES.sampleRequests.detail(row.sampleRequestId)}
            className="text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Yêu cầu mẫu
          </Link>
        ) : row.salesOrderId ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.salesOrderId)}
            className="text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Đơn bán
          </Link>
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
  ];
}

function ProductionListContent() {
  const router = useRouter();
  const canRead = useCan(PRODUCTION_ORDER_PERMISSIONS.read);
  const list = useServerList(STORAGE_KEYS.adminProductionOrdersConfig, PRODUCTION_API_STATUSES);
  const { filters } = list;
  const [types, setTypes] = useQueryState(
    "type",
    parseAsArrayOf(parseAsStringLiteral(PRODUCTION_ORDER_TYPES)).withDefault([]),
  );
  const [dueFrom, setDueFrom] = useQueryState("dueFrom", parseAsString.withDefault(""));
  const [dueTo, setDueTo] = useQueryState("dueTo", parseAsString.withDefault(""));
  const [salesOrderId, setSalesOrderId] = useQueryState(
    "salesOrderId",
    parseAsString.withDefault(""),
  );
  const [sortKey, sortDir] = filters.sort.split(",");
  const sortActive = SORTABLE.has(sortKey ?? "");
  const direction = sortDir === "desc" ? ("desc" as const) : ("asc" as const);
  const today = todayVn();
  const query = useProductionOrders(
    {
      page: list.apiPage,
      size: list.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
      type: types,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      salesOrderId: salesOrderId || undefined,
      // Hàng đợi xưởng: hạn giao sớm trước (BR-PRD-07).
      sort: sortActive ? `${sortKey},${direction}` : "dueDate,asc;createdAt,asc",
    },
    { enabled: canRead },
  );
  const hasFilters =
    list.hasBaseFilters || types.length > 0 || !!dueFrom || !!dueTo || !!salesOrderId;
  const resetPage = () => void filters.setPage(1);
  const clearAll = () => {
    filters.reset();
    void setTypes(null);
    void setDueFrom(null);
    void setDueTo(null);
    void setSalesOrderId(null);
  };

  return (
    <>
      <PageHeader
        title={PRODUCTION_COPY.pageTitle}
        subtitle="LSX mẫu và LSX đơn hàng — prepress, xuất phôi, in, QC, bàn giao đóng gói, gia công ngoài."
      />
      {canRead && (
        <ListToolbar
          search={filters.q}
          onSearchChange={(value) => void filters.setQ(value)}
          searchPlaceholder="Tìm theo số LSX (LSX-…)"
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
            {
              label: "Trạng thái",
              value: filters.status.map(productionStatusLabel).join(", ") || "Tất cả",
              active: filters.status.length > 0,
              onClear: () => void filters.setStatus([]),
            },
            {
              label: "Loại",
              value: types.map((type) => TYPE_LABEL[type]).join(", ") || "Tất cả",
              active: types.length > 0,
              onClear: () => void setTypes(null),
            },
            {
              label: "Hạn giao",
              value:
                dueFrom || dueTo
                  ? `${dueFrom ? formatDate(dueFrom) : "…"} → ${dueTo ? formatDate(dueTo) : "…"}`
                  : "Tất cả",
              active: !!dueFrom || !!dueTo,
              onClear: () => {
                void setDueFrom(null);
                void setDueTo(null);
              },
            },
            ...(salesOrderId
              ? [
                  {
                    label: "Đơn bán",
                    value: <span className={MONO}>{salesOrderId.slice(0, 8)}</span>,
                    active: true,
                    onClear: () => void setSalesOrderId(null),
                  },
                ]
              : []),
          ]}
          onResetAll={clearAll}
          resetDisabled={!hasFilters && !filters.sort}
        />
      )}
      {canRead && (
        <div className="bg-bg-subtle border-border-default mb-3 flex flex-wrap items-end gap-3 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
          <fieldset className="flex items-center gap-3">
            <legend className="sr-only">Loại LSX</legend>
            {PRODUCTION_ORDER_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  onChange={() => {
                    void setTypes(
                      types.includes(type)
                        ? types.filter((value) => value !== type)
                        : [...types, type],
                    );
                    resetPage();
                  }}
                  className="accent-[var(--brand)]"
                />
                {TYPE_LABEL[type]}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2">
            Hạn từ
            <Input
              type="date"
              value={dueFrom}
              onChange={(event) => {
                void setDueFrom(event.target.value || null);
                resetPage();
              }}
              className={`${FORM_INPUT_CLASS} w-40`}
            />
          </label>
          <label className="flex items-center gap-2">
            đến
            <Input
              type="date"
              value={dueTo}
              onChange={(event) => {
                void setDueTo(event.target.value || null);
                resetPage();
              }}
              className={`${FORM_INPUT_CLASS} w-40`}
            />
          </label>
        </div>
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns(today)}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.productionOrders.detail(row.id))}
        flagRow={(row) => row.status === "ON_HOLD" || isOverdue(row, today)}
        noun="lệnh sản xuất"
        errorCopy={PRODUCTION_COPY}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        empty={{
          icon: <Factory className="size-8" />,
          title: "Chưa có lệnh sản xuất",
          description:
            "LSX mẫu sinh khi Sales gửi sản xuất yêu cầu mẫu; LSX đơn sinh khi điều phối release đơn bán.",
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
            resetPage();
          },
        }}
      />
    </>
  );
}

export function ProductionList() {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.viewPage]} variant="list">
      <ProductionListContent />
    </PermissionBoundary>
  );
}
