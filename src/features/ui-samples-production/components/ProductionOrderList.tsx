"use client";

import { useState } from "react";
import { 
  Search, 
  Filter, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Printer, 
  ShieldAlert,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { ProductionOrder, ProductionOrderStatus, ProductionOrderType } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  onSelectOrder: (order: ProductionOrder) => void;
}

export function ProductionOrderList({ onSelectOrder }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const orders = samplesProductionRepo.getProductionOrders({
    type: typeFilter,
    status: statusFilter,
    search: searchTerm,
  });

  const getStatusBadge = (status: ProductionOrderStatus) => {
    switch (status) {
      case "Pending Prepress":
        return <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">Chờ Prepress</span>;
      case "Ready":
        return <span className="inline-flex items-center gap-1 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-2 py-0.5 text-xs font-semibold">Sẵn sàng in</span>;
      case "Material Issued":
        return <span className="inline-flex items-center gap-1 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 px-2 py-0.5 text-xs font-semibold">Đã xuất phôi</span>;
      case "Printing":
        return <span className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 text-xs font-semibold">Đang in</span>;
      case "QC":
        return <span className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold">Đang QC</span>;
      case "Completed":
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">Hoàn thành</span>;
      case "On Hold":
        return <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">Tạm dừng (Hold)</span>;
      case "Cancelled":
        return <span className="inline-flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold">Đã hủy</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{status}</span>;
    }
  };

  const getTypeBadge = (type: ProductionOrderType) => {
    if (type === "SAMPLE") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
          <Sparkles className="h-3 w-3" />
          <span>MẪU THỬ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
        <span>ĐƠN HÀNG</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)]">
            Danh sách Lệnh sản xuất (Production Orders - LSX)
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Lập kế hoạch, kiểm tra file prepress và theo dõi tiến độ in ấn theo nguyên tắc 1 LSX / dòng đơn (BR-PRD-01).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1">
            <span className="text-[var(--ink-secondary)]">Tổng LSX: </span>
            <strong className="font-mono">{orders.length}</strong>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-amber-800 dark:text-amber-300">
            <span>Chờ Prepress: </span>
            <strong className="font-mono">{orders.filter(o => o.status === "Pending Prepress").length}</strong>
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-rose-800 dark:text-rose-300">
            <span>Đang Hold: </span>
            <strong className="font-mono">{orders.filter(o => o.status === "On Hold").length}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo mã LSX, mã đơn hàng, tên khách hàng, mã phôi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          >
            <option value="ALL">Tất cả loại LSX</option>
            <option value="SAMPLE">Mẫu thử (SAMPLE)</option>
            <option value="ORDER">Đơn hàng (ORDER)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] font-medium">
            <tr>
              <th className="py-2.5 px-3">Mã LSX</th>
              <th className="py-2.5 px-3">Loại</th>
              <th className="py-2.5 px-3">Khách hàng / Đơn hàng</th>
              <th className="py-2.5 px-3">Phôi SKU</th>
              <th className="py-2.5 px-3 text-right">SL Kế hoạch</th>
              <th className="py-2.5 px-3 text-right">Đã in (Đạt/Phế)</th>
              <th className="py-2.5 px-3">Hạn giao</th>
              <th className="py-2.5 px-3">Trạng thái</th>
              <th className="py-2.5 px-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--ink-tertiary)]">
                  Không tìm thấy lệnh sản xuất nào phù hợp.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink-primary)]">
                    {o.code}
                  </td>
                  <td className="py-2.5 px-3">
                    {getTypeBadge(o.type)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[var(--ink-primary)]">{o.customerName}</div>
                    <div className="text-[11px] font-mono text-[var(--ink-tertiary)]">
                      {o.orderCode ? `Đơn hàng: ${o.orderCode}` : `Nguồn mẫu: ${o.sourceId}`}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono text-[var(--ink-primary)]">{o.blankSku}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)]">{o.blankName}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--ink-primary)]">
                    {o.plannedQuantity.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">{o.goodQuantity}</span>
                    <span className="text-[var(--ink-tertiary)]"> / </span>
                    <span className="text-rose-600 dark:text-rose-400">{o.scrapQuantity}</span>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--ink-secondary)]">
                    {o.dueDate}
                  </td>
                  <td className="py-2.5 px-3">
                    {getStatusBadge(o.status)}
                    {o.holdReason && (
                      <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 truncate max-w-[160px]" title={o.holdReason}>
                        ⚠️ {o.holdReason}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectOrder(o)}
                      className="inline-flex items-center gap-1 rounded bg-[var(--brand)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Xử lý LSX</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
