"use client";

import { useState } from "react";
import { Plus, Search, ExternalLink, Eye } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { SampleRequest } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  onSelectSample: (sample: SampleRequest) => void;
  onOpenCreate: () => void;
  onOpenPortal: (sample: SampleRequest) => void;
}

export function SampleRequestList({ onSelectSample, onOpenCreate, onOpenPortal }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const samples = samplesProductionRepo.getSampleRequests({
    status: statusFilter,
    search: searchTerm,
  });

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)]">
            Danh sách Yêu cầu Làm mẫu (Sample Requests)
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý vòng duyệt mẫu thử, phê duyệt thiết kế trước khi đưa vào sản xuất hàng loạt
            (BR-PRD-08).
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-medium text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo yêu cầu mẫu mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo mã mẫu, tên khách hàng, mã phôi SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1.5 pr-3 pl-8 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs whitespace-nowrap text-[var(--ink-tertiary)]">Trạng thái:</span>
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
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] font-medium text-[var(--ink-secondary)]">
            <tr>
              <th className="px-3 py-2.5">Mã mẫu</th>
              <th className="px-3 py-2.5">Khách hàng</th>
              <th className="px-3 py-2.5">Phôi & Thiết kế</th>
              <th className="px-3 py-2.5 text-center">Vòng duyệt</th>
              <th className="px-3 py-2.5 text-center">SL Mẫu</th>
              <th className="px-3 py-2.5">Hạn giao</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
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
                <tr key={s.id} className="transition-colors hover:bg-[var(--bg-subtle)]">
                  <td className="px-3 py-2.5 font-mono font-medium text-[var(--ink-primary)]">
                    {s.code}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[var(--ink-primary)]">{s.customerName}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)]">{s.customerEmail}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[var(--ink-primary)]">{s.designName}</div>
                    <div className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                      {s.blankSku}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ink-secondary)] dark:bg-slate-800">
                      R{s.roundNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-medium">
                    {s.sampleQuantity}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[var(--ink-secondary)]">
                    {s.dueDate}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="space-x-1 px-3 py-2.5 text-right whitespace-nowrap">
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
                      className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
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
