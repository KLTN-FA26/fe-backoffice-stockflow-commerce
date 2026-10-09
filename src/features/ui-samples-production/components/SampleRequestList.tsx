"use client";

import { useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Eye, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Truck,
  RotateCcw
} from "lucide-react";
import { SampleRequest, SampleStatus } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  onSelectSample: (sample: SampleRequest) => void;
  onOpenCreate: () => void;
  onOpenPortal: (sample: SampleRequest) => void;
}

export function SampleRequestList({ onSelectSample, onOpenCreate, onOpenPortal }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [version, setVersion] = useState(0);

  const samples = samplesProductionRepo.getSampleRequests({
    status: statusFilter,
    search: searchTerm,
  });

  const getStatusBadge = (status: SampleStatus) => {
    switch (status) {
      case "Approved":
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">Đã duyệt (Khoá mẫu)</span>;
      case "Changes Requested":
        return <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-xs font-semibold">Yêu cầu sửa mẫu</span>;
      case "Sent to Customer":
        return <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-xs font-semibold">Đã gửi khách</span>;
      case "In Production":
        return <span className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-0.5 text-xs font-semibold">Đang in mẫu</span>;
      case "Ready":
        return <span className="inline-flex items-center gap-1 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-2 py-0.5 text-xs font-semibold">Mẫu hoàn thành</span>;
      case "Submitted":
        return <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">Chờ sản xuất</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)]">
            Danh sách Yêu cầu Làm mẫu (Sample Requests)
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý vòng duyệt mẫu thử, phê duyệt thiết kế trước khi đưa vào sản xuất hàng loạt (BR-PRD-08).
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo yêu cầu mẫu mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo mã mẫu, tên khách hàng, mã phôi SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--ink-tertiary)] whitespace-nowrap">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Draft">Nháp (Draft)</option>
            <option value="Submitted">Chờ sản xuất (Submitted)</option>
            <option value="In Production">Đang in (In Production)</option>
            <option value="Ready">Mẫu sẵn sàng (Ready)</option>
            <option value="Sent to Customer">Đã gửi khách (Sent to Customer)</option>
            <option value="Approved">Đã duyệt (Approved)</option>
            <option value="Changes Requested">Yêu cầu sửa (Changes Requested)</option>
          </select>
        </div>
      </div>

      {/* Samples Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] font-medium">
            <tr>
              <th className="py-2.5 px-3">Mã mẫu</th>
              <th className="py-2.5 px-3">Khách hàng</th>
              <th className="py-2.5 px-3">Phôi & Thiết kế</th>
              <th className="py-2.5 px-3 text-center">Vòng duyệt</th>
              <th className="py-2.5 px-3 text-center">SL Mẫu</th>
              <th className="py-2.5 px-3">Hạn giao</th>
              <th className="py-2.5 px-3">Trạng thái</th>
              <th className="py-2.5 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {samples.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--ink-tertiary)]">
                  Không tìm thấy yêu cầu mẫu nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              samples.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-[var(--ink-primary)]">
                    {s.code}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[var(--ink-primary)]">{s.customerName}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)]">{s.customerEmail}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[var(--ink-primary)]">{s.designName}</div>
                    <div className="text-[11px] font-mono text-[var(--ink-tertiary)]">{s.blankSku}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink-secondary)]">
                      R{s.roundNumber}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-medium">
                    {s.sampleQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--ink-secondary)]">
                    {s.dueDate}
                  </td>
                  <td className="py-2.5 px-3">
                    {getStatusBadge(s.status)}
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => onSelectSample(s)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-default)] px-2 py-1 text-[11px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
                      title="Xem chi tiết Backoffice"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Chi tiết</span>
                    </button>
                    <button
                      onClick={() => onOpenPortal(s)}
                      className="inline-flex items-center gap-1 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                      title="Mở giao diện duyệt của khách hàng (Customer Portal)"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Portal khách</span>
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
