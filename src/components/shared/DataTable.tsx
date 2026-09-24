"use client";

import { useState, useMemo } from "react";
import { cn } from "cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  Column config                                                            */
/* -------------------------------------------------------------------------- */

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Render cell content. Return ReactNode. */
  cell: (row: T) => ReactNode;
  /** Enable sorting by this column. */
  sortable?: boolean;
  /** Custom sort comparator. Default: localeCompare / numeric compare. */
  compare?: (a: T, b: T) => number;
  /** Align right for numbers. */
  align?: "left" | "right" | "center";
  /** Fixed width class. */
  className?: string;
  /** Header extra class */
  headerClassName?: string;
  searchable?: boolean;
  headerSearch?: ReactNode;
  headerFilter?: ReactNode;
  hasHeaderFilter?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  DataTable                                                                */
/* -------------------------------------------------------------------------- */

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Unique row key extractor. */
  rowKey: (row: T) => string;
  caption?: string;
  /** Row gets `flag` left-border warning when true. */
  flagRow?: (row: T) => boolean;
  /** Click handler on row. */
  onRowClick?: (row: T) => void;
  /** Enable bulk-select checkbox column. */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Page size. Default 10. */
  pageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
  /** Server pagination — when set, table defers paging to parent. */
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

type SortDir = "asc" | "desc";

export function DataTable<T>({
  data,
  columns,
  rowKey,
  caption,
  flagRow,
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  pageSize = 10,
  pageSizeOptions = [10, 15, 20, 50],
  className,
  total,
  page: controlledPage,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [innerPage, setInnerPage] = useState(0);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const isServerPaged = total !== undefined;

  const effectivePageSize = isServerPaged ? pageSize : currentPageSize;
  const effectivePage = isServerPaged ? Math.max(0, (controlledPage ?? 1) - 1) : innerPage;

  // Sort — skip in server mode (BE owns sort via `sort` param)
  const sorted = useMemo(() => {
    if (isServerPaged) return data;
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return data;
    const arr = [...data];
    if (col.compare) {
      arr.sort((a, b) => (sortDir === "asc" ? col.compare!(a, b) : col.compare!(b, a)));
    }
    return arr;
  }, [data, columns, sortKey, sortDir, isServerPaged]);

  // Paginate — server: data is already the page slice
  const totalPages = isServerPaged
    ? Math.max(1, Math.ceil(total! / effectivePageSize))
    : Math.max(1, Math.ceil(sorted.length / effectivePageSize));
  const safePage = Math.min(effectivePage, totalPages - 1);
  const pageData = isServerPaged
    ? sorted
    : sorted.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize);
  const shouldScroll = pageData.length > 10;

  const handleSort = (key: string) => {
    if (isServerPaged) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handlePageSizeChange = (value: string) => {
    const next = Number(value);
    if (isServerPaged) {
      onPageSizeChange?.(next);
      onPageChange?.(1);
    } else {
      setCurrentPageSize(next);
      setInnerPage(0);
    }
  };

  const goPage = (next0: number) => {
    if (isServerPaged) onPageChange?.(next0 + 1);
    else setInnerPage(next0);
  };

  // Selection helpers
  const allSelected = pageData.length > 0 && pageData.every((r) => selectedKeys?.has(rowKey(r)));
  const toggleAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (allSelected) {
      pageData.forEach((r) => next.delete(rowKey(r)));
    } else {
      pageData.forEach((r) => next.add(rowKey(r)));
    }
    onSelectionChange(next);
  };

  const toggleOne = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div
      className={cn(
        "border-border-default bg-bg-surface overflow-hidden rounded-[var(--r-sm)] border",
        className,
      )}
    >
      <div className={cn(shouldScroll && "max-h-[520px] overflow-y-auto")}>
        <Table>
          <TableHeader className={cn(shouldScroll && "sticky top-0 z-10")}>
            <TableRow className="border-border-default bg-bg-subtle hover:bg-bg-subtle">
              {selectable && (
                <TableHead className="w-[34px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-ink-secondary text-xs font-semibold",
                    col.align === "right" && "text-right",
                    col.headerClassName,
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      col.align === "right" && "justify-end",
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!col.sortable}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={cn(
                        "text-ink-secondary h-auto min-w-0 justify-start gap-1 rounded-none bg-transparent p-0 text-left text-xs font-semibold hover:bg-transparent",
                        col.sortable && "hover:text-ink-primary cursor-pointer select-none",
                        !col.sortable && "cursor-default opacity-100 disabled:opacity-100",
                      )}
                    >
                      <span className="truncate">{col.header}</span>
                      {col.sortable && (
                        <span className="text-ink-tertiary shrink-0">
                          {sortKey === col.key ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </Button>
                    {col.headerFilter}
                  </div>
                  {col.headerSearch && <div className="mt-1.5 w-full">{col.headerSearch}</div>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-ink-tertiary py-8 text-center"
                >
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row) => {
                const key = rowKey(row);
                const isFlag = flagRow?.(row) ?? false;
                return (
                  <TableRow
                    key={key}
                    data-state={selectedKeys?.has(key) ? "selected" : undefined}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "border-border-default transition-colors",
                      onRowClick && "cursor-pointer",
                      isFlag && "shadow-[inset_2px_0_0_var(--warning)]",
                    )}
                  >
                    {selectable && (
                      <TableCell className="w-[34px]">
                        <Checkbox
                          checked={selectedKeys?.has(key) ?? false}
                          onCheckedChange={() => toggleOne(key)}
                          aria-label={`Chọn ${key}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "text-[0.8125rem]",
                          col.align === "right" && "text-right tabular-nums",
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {(caption || totalPages > 1 || isServerPaged) && (
        <div className="border-border-default bg-bg-subtle text-ink-secondary flex flex-wrap items-center justify-between gap-3 border-t px-3.5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-tertiary">Dòng/trang</span>
              <Select value={String(effectivePageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger
                  size="sm"
                  aria-label="Dòng mỗi trang"
                  className="bg-bg-surface h-7 rounded-[var(--r-sm)] px-2 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectLabel>Dòng/trang</SelectLabel>
                    {pageSizeOptions.map((option) => (
                      <SelectItem key={option} value={String(option)} className="text-xs">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <span>
              {isServerPaged
                ? `Hiển thị ${total === 0 ? 0 : safePage * effectivePageSize + 1}–${Math.min((safePage + 1) * effectivePageSize, total!)} / ${total}`
                : totalPages > 1
                  ? `Hiển thị ${safePage * effectivePageSize + 1}–${Math.min((safePage + 1) * effectivePageSize, sorted.length)} / ${sorted.length}`
                  : (caption ?? `Hiển thị ${sorted.length} / ${sorted.length}`)}
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={safePage === 0}
                onClick={() => goPage(safePage - 1)}
                className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] disabled:opacity-40"
                aria-label="Trước"
              >
                ‹
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-current={i === safePage ? "true" : undefined}
                  onClick={() => goPage(i)}
                  className={cn(
                    "min-w-7 rounded-[var(--r-sm)] border text-xs",
                    i === safePage
                      ? "border-brand bg-brand text-ink-inverse hover:bg-brand hover:text-ink-inverse font-medium"
                      : "border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary",
                  )}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => goPage(safePage + 1)}
                className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] disabled:opacity-40"
                aria-label="Sau"
              >
                ›
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
