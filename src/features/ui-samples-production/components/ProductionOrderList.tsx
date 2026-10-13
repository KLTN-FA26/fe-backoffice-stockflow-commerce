"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ProductionOrder, ProductionOrderType } from "../types";
import { samplesProductionRepo } from "../mock-repo";
import { StatusBadge } from "@/components/shared";

interface Props {
  onSelectOrder: (order: ProductionOrder) => void;
}

export type DueDateFilterType = "ALL" | "TODAY" | "THIS_WEEK" | "OVERDUE" | "CUSTOM";

export function ProductionOrderList({ onSelectOrder }: Props) {
  // Composable Filter States
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilterType>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Lấy dữ liệu cơ sở từ repo
  const allOrders = samplesProductionRepo.getProductionOrders();

  // Reference dates for Due Date filtering (mốc chuẩn 2026-10-09)
  const todayStr = "2026-10-09";
  // Cuối tuần tính đến Chủ nhật 2026-10-11
  const endOfWeekStr = "2026-10-11";

  // Lọc đa tiêu chí kết hợp (Composable Filters)
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // 1. Lọc theo Loại (SAMPLE / ORDER)
      if (typeFilter !== "ALL" && order.type !== typeFilter) {
        return false;
      }

      // 2. Lọc theo Trạng thái sản xuất
      if (statusFilter !== "ALL" && order.status !== statusFilter) {
        return false;
      }

      // 3. Lọc theo Từ khóa tìm kiếm
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesCode = order.code.toLowerCase().includes(q);
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesSku = order.blankSku.toLowerCase().includes(q);
        const matchesBlankName = order.blankName.toLowerCase().includes(q);
        const matchesOrderCode = order.orderCode
          ? order.orderCode.toLowerCase().includes(q)
          : false;
        if (
          !matchesCode &&
          !matchesCustomer &&
          !matchesSku &&
          !matchesBlankName &&
          !matchesOrderCode
        ) {
          return false;
        }
      }

      // 4. Lọc theo Hạn giao hàng (Due Date Filter)
      if (dueDateFilter === "TODAY") {
        if (order.dueDate !== todayStr) return false;
      } else if (dueDateFilter === "THIS_WEEK") {
        if (order.dueDate < todayStr || order.dueDate > endOfWeekStr) return false;
      } else if (dueDateFilter === "OVERDUE") {
        // Quá hạn nếu hạn giao < hôm nay và chưa hoàn thành / chưa hủy
        const isOverdue =
          order.dueDate < todayStr && order.status !== "Completed" && order.status !== "Cancelled";
        if (!isOverdue) return false;
      } else if (dueDateFilter === "CUSTOM") {
        if (customStartDate && order.dueDate < customStartDate) return false;
        if (customEndDate && order.dueDate > customEndDate) return false;
      }

      return true;
    });
  }, [
    allOrders,
    typeFilter,
    statusFilter,
    dueDateFilter,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  // Reset trang về 1 khi bất kỳ bộ lọc nào thay đổi
  const handleTypeChange = (val: string) => {
    setTypeFilter(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleDueDateChange = (val: DueDateFilterType) => {
    setDueDateFilter(val);
    setCurrentPage(1);
  };

  const handleCustomStartChange = (val: string) => {
    setCustomStartDate(val);
    setCurrentPage(1);
  };

  const handleCustomEndChange = (val: string) => {
    setCustomEndDate(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setDueDateFilter("ALL");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Tính toán phân trang
  const totalCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Có bộ lọc nào đang kích hoạt không
  const isFiltered =
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    dueDateFilter !== "ALL" ||
    searchTerm.trim() !== "";

  const getTypeBadge = (type: ProductionOrderType) => {
    return (
      <StatusBadge
        status={type === "SAMPLE" ? "MẪU THỬ" : "ĐƠN HÀNG"}
        label={type === "SAMPLE" ? "MẪU THỬ" : "ĐƠN HÀNG"}
        size="sm"
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Title & Stats */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)]">
            Danh sách Lệnh sản xuất (Production Orders - LSX)
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý kế hoạch in ấn, kiểm tra prepress và theo dõi tiến độ theo nguyên tắc 1 LSX /
            dòng đơn (BR-PRD-01).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1">
            <span className="text-[var(--ink-secondary)]">Tổng LSX: </span>
            <strong className="font-mono">{allOrders.length}</strong>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span>Chờ Prepress: </span>
            <strong className="font-mono">
              {allOrders.filter((o) => o.status === "Pending Prepress").length}
            </strong>
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <span>Đang Hold: </span>
            <strong className="font-mono">
              {allOrders.filter((o) => o.status === "On Hold").length}
            </strong>
          </div>
          <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <span>Quá hạn: </span>
            <strong className="font-mono">
              {
                allOrders.filter(
                  (o) =>
                    o.dueDate < todayStr && o.status !== "Completed" && o.status !== "Cancelled",
                ).length
              }
            </strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
            <input
              type="text"
              placeholder="Tìm theo mã LSX, mã đơn hàng, tên khách hàng, mã phôi..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1.5 pr-3 pl-8 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc Loại LSX */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
            >
              <option value="ALL">Tất cả loại LSX</option>
              <option value="SAMPLE">Mẫu thử (SAMPLE)</option>
              <option value="ORDER">Đơn hàng (ORDER)</option>
            </select>

            {/* Lọc Trạng thái */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Pending Prepress">Chờ Prepress</option>
              <option value="Ready">Sẵn sàng in</option>
              <option value="Material Issued">Đã xuất phôi</option>
              <option value="Printing">Đang in</option>
              <option value="QC">Đang QC</option>
              <option value="Completed">Hoàn thành</option>
              <option value="On Hold">Đang Hold</option>
              <option value="Cancelled">Đã hủy</option>
            </select>

            {/* Lọc Hạn giao (Due Date Filter) */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)]" />
              <select
                value={dueDateFilter}
                onChange={(e) => handleDueDateChange(e.target.value as DueDateFilterType)}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
              >
                <option value="ALL">Tất cả hạn giao</option>
                <option value="TODAY">Hạn hôm nay (09/10)</option>
                <option value="THIS_WEEK">Hạn trong tuần này</option>
                <option value="OVERDUE">Đã quá hạn giao</option>
                <option value="CUSTOM">Khoảng ngày tùy chọn...</option>
              </select>
            </div>

            {/* Nút Xóa bộ lọc nếu có điều kiện đang lọc */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
                title="Đặt lại toàn bộ bộ lọc"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Khung nhập ngày tùy chọn nếu chọn CUSTOM */}
        {dueDateFilter === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-default)] pt-2 text-xs text-[var(--ink-secondary)]">
            <span>Từ ngày:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--ink-primary)]"
            />
            <span>Đến ngày:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--ink-primary)]"
            />
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] font-medium text-[var(--ink-secondary)]">
            <tr>
              <th className="px-3 py-2.5">Mã LSX</th>
              <th className="px-3 py-2.5">Loại</th>
              <th className="px-3 py-2.5">Khách hàng / Đơn hàng</th>
              <th className="px-3 py-2.5">Phôi SKU</th>
              <th className="px-3 py-2.5 text-right">SL Kế hoạch</th>
              <th className="px-3 py-2.5 text-right">Đã in (Đạt/Phế)</th>
              <th className="px-3 py-2.5">Hạn giao</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[var(--ink-tertiary)]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter className="h-6 w-6 text-[var(--ink-tertiary)] opacity-40" />
                    <p className="font-medium text-[var(--ink-secondary)]">
                      Không tìm thấy lệnh sản xuất nào phù hợp với bộ lọc.
                    </p>
                    {isFiltered && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs text-[var(--ink-inverse)] transition-colors hover:bg-[var(--brand-hover)]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Xóa tất cả bộ lọc</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedOrders.map((o) => {
                const isOverdue =
                  o.dueDate < todayStr && o.status !== "Completed" && o.status !== "Cancelled";
                return (
                  <tr key={o.id} className="transition-colors hover:bg-[var(--bg-subtle)]">
                    <td className="px-3 py-2.5 font-mono font-bold text-[var(--ink-primary)]">
                      {o.code}
                    </td>
                    <td className="px-3 py-2.5">{getTypeBadge(o.type)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--ink-primary)]">{o.customerName}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                        {o.orderCode ? `Đơn hàng: ${o.orderCode}` : `Nguồn mẫu: ${o.sourceId}`}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[var(--ink-primary)]">{o.blankSku}</div>
                      <div className="text-[11px] text-[var(--ink-tertiary)]">{o.blankName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[var(--ink-primary)]">
                      {o.plannedQuantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px]">
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {o.goodQuantity}
                      </span>
                      <span className="text-[var(--ink-tertiary)]"> / </span>
                      <span className="text-rose-600 dark:text-rose-400">{o.scrapQuantity}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={
                          isOverdue
                            ? "flex items-center gap-1 font-bold text-red-600 dark:text-red-400"
                            : "text-[var(--ink-secondary)]"
                        }
                      >
                        {isOverdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {o.dueDate}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                      {o.holdReason && (
                        <div
                          className="mt-1 max-w-[160px] truncate text-[10px] text-rose-600 dark:text-rose-400"
                          title={o.holdReason}
                        >
                          ⚠️ {o.holdReason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectOrder(o)}
                        className="inline-flex items-center gap-1 rounded bg-[var(--brand)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Xử lý LSX</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar (SCRUM-406 Pagination Controls) */}
        {totalCount > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--ink-secondary)] sm:flex-row">
            <div className="flex items-center gap-3">
              <span data-testid="pagination-info">
                Hiển thị{" "}
                <strong className="font-mono text-[var(--ink-primary)]">{startIndex + 1}</strong> –{" "}
                <strong className="font-mono text-[var(--ink-primary)]">{endIndex}</strong> trên
                tổng số{" "}
                <strong className="font-mono text-[var(--ink-primary)]">{totalCount}</strong> lệnh
                sản xuất
              </span>

              {/* Selector kích thước trang */}
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--ink-tertiary)]">|</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--ink-primary)]"
                >
                  <option value={2}>2 dòng / trang</option>
                  <option value={5}>5 dòng / trang</option>
                  <option value={10}>10 dòng / trang</option>
                  <option value={20}>20 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                </select>
              </div>
            </div>

            {/* Điều hướng trang */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validPage <= 1}
                className="inline-flex items-center justify-center rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)] disabled:pointer-events-none disabled:opacity-40"
                title="Trang đầu"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage <= 1}
                className="inline-flex items-center justify-center rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)] disabled:pointer-events-none disabled:opacity-40"
                title="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-2 font-mono font-medium text-[var(--ink-primary)]">
                Trang {validPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage >= totalPages}
                className="inline-flex items-center justify-center rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)] disabled:pointer-events-none disabled:opacity-40"
                title="Trang kế tiếp"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validPage >= totalPages}
                className="inline-flex items-center justify-center rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)] disabled:pointer-events-none disabled:opacity-40"
                title="Trang cuối"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
