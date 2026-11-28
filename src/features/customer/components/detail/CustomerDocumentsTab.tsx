"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ShoppingCart } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import { ADMIN_ROUTES, PAGE_SIZE } from "@/constants";
import { useCustomerOrders, useCustomerQuotes } from "@/features/customer/queries";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";

import { ORDER_COLUMNS, QUOTE_COLUMNS, ordersOfCustomer } from "./customer-document-columns";
import { CUSTOMER_DOCUMENTS_COPY as L } from "./documents-copy";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ColumnDef } from "@/components/shared/DataTable";

/** EmptyState bỏ khung khi nằm trong thân bảng (backoffice-erp-ui A7). */
const IN_TABLE_EMPTY = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

interface Copy {
  noun: string;
  empty: string;
  emptyHint: string;
  openList: string;
  loadError: string;
}

/**
 * Bảng chứng từ của khách trong tab (backoffice-erp-ui B12, B16): khung bảng tự có, không bọc thêm thẻ; phân trang
 * server; trên bảng là số chứng từ và lối mở trang danh sách đầy đủ (đã lọc theo khách).
 */
function DocumentsTable<T>({
  query,
  columns,
  rowKey,
  copy,
  icon,
  listHref,
  onPageChange,
  onPageSizeChange,
}: {
  query: UseQueryResult<PaginatedResponse<T>>;
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  copy: Copy;
  icon: ReactNode;
  listHref: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (query.isError)
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {copy.loadError}{" "}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          {L.retry}
        </button>
      </p>
    );
  if (query.isPending) return <Skeleton className="h-40" />;
  const page = query.data;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
        <span className="text-ink-secondary tabular-nums">
          {L.total(page.totalElements, copy.noun)}
        </span>
        <Link href={listHref} className="text-accent-text font-medium hover:underline">
          {copy.openList}
        </Link>
      </div>
      <DataTable
        data={page.items}
        columns={columns}
        rowKey={rowKey}
        serverPagination={{ ...page, onPageChange, onPageSizeChange }}
        emptyState={
          <EmptyState
            className={IN_TABLE_EMPTY}
            icon={icon}
            title={copy.empty}
            description={copy.emptyHint}
          />
        }
      />
    </div>
  );
}

/** Trang của bảng trên URL (`?quotesPage=` / `?ordersPage=`, đánh số từ 1), cỡ trang là lựa chọn tạm trong phiên. */
function usePaging(key: string) {
  const [page, setPage] = useQueryState(key, parseAsInteger.withDefault(1));
  const [size, setSize] = useState<number>(PAGE_SIZE.sm);
  return {
    page: Math.max(0, page - 1),
    size,
    onPageChange: (zeroBased: number) => void setPage(zeroBased > 0 ? zeroBased + 1 : null),
    onPageSizeChange: (next: number) => {
      setSize(next);
      void setPage(null);
    },
  };
}

export function CustomerQuotesTab({ customerId }: { customerId: string }) {
  const paging = usePaging("quotesPage");
  const query = useCustomerQuotes({ customerId, page: paging.page, size: paging.size });
  return (
    <DocumentsTable
      query={query}
      columns={QUOTE_COLUMNS}
      rowKey={(row) => row.id}
      copy={L.quotes}
      icon={<FileText className="size-8" />}
      listHref={ADMIN_ROUTES.quotes.byCustomer(customerId)}
      onPageChange={paging.onPageChange}
      onPageSizeChange={paging.onPageSizeChange}
    />
  );
}

export function CustomerOrdersTab({ customerId }: { customerId: string }) {
  const paging = usePaging("ordersPage");
  const query = useCustomerOrders({ customerId, page: paging.page, size: paging.size });
  return (
    <DocumentsTable
      query={query}
      columns={ORDER_COLUMNS}
      rowKey={(row) => row.orderId}
      copy={L.orders}
      icon={<ShoppingCart className="size-8" />}
      listHref={ordersOfCustomer(customerId)}
      onPageChange={paging.onPageChange}
      onPageSizeChange={paging.onPageSizeChange}
    />
  );
}
