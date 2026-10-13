"use client";

import { useState } from "react";
import {
  Search,
  Eye,
  Send,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { B2BQuote } from "../types";
import { b2bRepo } from "../mock-repo";

interface Props {
  onSelectQuote: (quote: B2BQuote) => void;
  onOpenPortal: (quote: B2BQuote) => void;
  onRefresh: () => void;
}

export function B2BQuoteList({ onSelectQuote, onOpenPortal, onRefresh }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const quotes = b2bRepo.getQuotes({
    status: statusFilter,
    search: searchTerm,
  });

  const handleSendQuote = (quote: B2BQuote) => {
    b2bRepo.sendQuote(quote.id);
    onRefresh();
  };

  const handleReviseQuote = (quote: B2BQuote) => {
    b2bRepo.reviseQuote(quote.id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
            <DollarSign className="h-5 w-5 text-amber-600" />
            <span>Quản Lý Báo Giá Khách Hàng B2B (Sales Quotations — SCRUM-449)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Lập báo giá nhiều bậc số lượng (Tier Pricing), kiểm tra điều kiện duyệt mẫu thiết kế mới
            (BR-PRD-08), và gửi portal khách duyệt.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo mã báo giá, tên công ty, mã số thuế..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1.5 pr-3 pl-8 text-xs text-[var(--ink-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs whitespace-nowrap text-[var(--ink-tertiary)]">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="SENT">Đã gửi khách</option>
            <option value="ACCEPTED">Khách đã duyệt</option>
            <option value="CHANGES_REQUESTED">Yêu cầu sửa</option>
            <option value="EXPIRED">Hết hạn</option>
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] font-medium text-[var(--ink-secondary)]">
            <tr>
              <th className="px-3 py-2.5">Mã báo giá</th>
              <th className="px-3 py-2.5">Khách hàng B2B</th>
              <th className="px-3 py-2.5">Điều khoản / Hạn</th>
              <th className="px-3 py-2.5 text-right">Tổng giá trị (VNĐ)</th>
              <th className="px-3 py-2.5">Cảnh báo Thiết kế mới</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--ink-tertiary)]">
                  Không tìm thấy báo giá nào phù hợp.
                </td>
              </tr>
            ) : (
              quotes.map((q) => {
                const hasUnapprovedNew = q.lines.some((l) => l.isNewDesign && !l.sampleApproved);
                return (
                  <tr key={q.id} className="transition-colors hover:bg-[var(--bg-subtle)]">
                    <td className="px-3 py-2.5 font-mono font-bold text-[var(--ink-primary)]">
                      <div>{q.code}</div>
                      <div className="text-[10px] text-[var(--ink-tertiary)]">
                        Phiên bản: v{q.version}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--ink-primary)]">{q.customerName}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                        MST: {q.customerTaxCode}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-sky-700 dark:text-sky-400">
                        {q.paymentTerm}
                      </div>
                      <div className="text-[11px] whitespace-nowrap text-[var(--ink-tertiary)]">
                        Hạn: {q.validUntil}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[var(--ink-primary)]">
                      {q.grandTotal.toLocaleString()} đ
                    </td>
                    <td className="px-3 py-2.5">
                      {hasUnapprovedNew ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span>Cần duyệt mẫu trước</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Đã đủ điều kiện</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="space-x-1 px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectQuote(q)}
                        className="inline-flex items-center gap-1 rounded border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Chi tiết</span>
                      </button>

                      {q.status === "DRAFT" && (
                        <button
                          onClick={() => handleSendQuote(q)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] text-white shadow-xs hover:bg-blue-700"
                        >
                          <Send className="h-3 w-3" />
                          <span>Gửi khách</span>
                        </button>
                      )}

                      {q.status === "CHANGES_REQUESTED" && (
                        <button
                          onClick={() => handleReviseQuote(q)}
                          className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[11px] text-white shadow-xs hover:bg-amber-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Lập bản sửa (v{q.version + 1})</span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenPortal(q)}
                        className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                        title="Xem giao diện duyệt của khách hàng"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Portal</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
