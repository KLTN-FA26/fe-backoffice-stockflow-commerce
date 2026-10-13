"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Printer,
  Eye,
  X,
  AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { batch2Repo } from "../mock-repo";
import { RmaRequest } from "../types";

export function RmaApprovalBackofficeView() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRma, setSelectedRma] = useState<RmaRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState<RmaRequest | null>(null);
  const [, setTick] = useState(0);

  const rmas = batch2Repo.getRmaRequests().filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        r.rmaCode.toLowerCase().includes(q) ||
        r.orderCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApprove = (rma: RmaRequest) => {
    batch2Repo.approveRma(rma.id, "Trần Bảo An (Trưởng phòng CSKH)", adminNote);
    setSelectedRma(null);
    setAdminNote("");
    setRejectError(null);
    setTick((t) => t + 1);
  };

  const handleReject = (rma: RmaRequest) => {
    if (!adminNote.trim()) {
      setRejectError(
        "Vui lòng nhập lý do từ chối cụ thể trong ô ý kiến thẩm định để gửi phản hồi cho khách hàng!",
      );
      return;
    }
    batch2Repo.rejectRma(rma.id, "Trần Bảo An (Trưởng phòng CSKH)", adminNote);
    setSelectedRma(null);
    setAdminNote("");
    setRejectError(null);
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <span>Hàng Đợi Duyệt Đổi Trả RMA Backoffice (RMA Approval Workflow — SCRUM-258)</span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Bộ phận Quản lý Đơn hàng & CSKH thẩm định yêu cầu bảo hành/đổi trả, phát hành mã ủy quyền
          (RMA Auth) và nhãn vận chuyển thu hồi.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-[var(--ink-tertiary)]" />
          <input
            type="text"
            placeholder="Tìm theo mã RMA, mã đơn hàng, tên khách hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1.5 pr-3 pl-8 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs whitespace-nowrap text-[var(--ink-secondary)]">
            Trạng thái:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)]"
          >
            <option value="ALL">Tất cả ({batch2Repo.getRmaRequests().length})</option>
            <option value="PENDING">Chờ duyệt (Pending)</option>
            <option value="APPROVED">Đã phê duyệt (Approved)</option>
            <option value="REJECTED">Từ chối (Rejected)</option>
          </select>
        </div>
      </div>

      {/* RMA Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-muted)] font-medium text-[var(--ink-secondary)]">
            <tr>
              <th className="px-3 py-2.5">Mã RMA</th>
              <th className="px-3 py-2.5">Đơn hàng gốc</th>
              <th className="px-3 py-2.5">Khách hàng</th>
              <th className="px-3 py-2.5">Hình thức</th>
              <th className="px-3 py-2.5 text-right">SL Đổi trả</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Ngày gửi</th>
              <th className="px-3 py-2.5">Mã ủy quyền</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {rmas.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-[var(--ink-tertiary)]">
                  Không tìm thấy yêu cầu RMA nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              rmas.map((r) => {
                const totalReturnQty = r.lines.reduce((acc, l) => acc + l.returnQty, 0);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-[var(--bg-subtle)]">
                    <td className="px-3 py-2.5 font-mono font-bold text-[var(--brand)]">
                      {r.rmaCode}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--ink-primary)]">
                      {r.orderCode}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--ink-primary)]">{r.customerName}</div>
                      <div className="text-[11px] text-[var(--ink-tertiary)]">
                        {r.customerPhone}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          r.type === "EXCHANGE"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {r.type === "EXCHANGE" ? "🔄 ĐỔI MỚI" : "💰 HOÀN TIỀN"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[var(--ink-primary)]">
                      {totalReturnQty.toLocaleString()} cái
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--ink-secondary)]">
                      {r.submittedAt}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {r.returnAuthCode ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {r.returnAuthCode}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedRma(r);
                          setAdminNote(r.adminNote || "");
                        }}
                        className="inline-flex items-center gap-1 rounded bg-[var(--brand)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Xem & Duyệt</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inspection & Approval Modal */}
      {selectedRma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
              <div>
                <h3 className="flex items-center gap-2 font-mono text-base font-bold text-[var(--ink-primary)]">
                  <span>{selectedRma.rmaCode} — Hồ sơ thẩm định RMA</span>
                  <StatusBadge status={selectedRma.status} />
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Đơn hàng gốc: <strong>{selectedRma.orderCode}</strong> · Khách:{" "}
                  <strong>{selectedRma.customerName}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedRma(null)}
                className="text-sm text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Product Lines & Evidence Photos */}
            <div className="space-y-4 text-xs">
              {selectedRma.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[var(--ink-primary)]">{line.productName}</h4>
                      <span className="font-mono text-[11px] text-[var(--ink-secondary)]">
                        {line.sku}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        Yêu cầu trả: {line.returnQty.toLocaleString()} /{" "}
                        {line.deliveredQty.toLocaleString()} cái
                      </span>
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="font-semibold text-[var(--ink-secondary)]">
                      Lý do khiếu nại:{" "}
                    </span>
                    <strong className="text-[var(--ink-primary)]">{line.reason}</strong>
                    <p className="mt-1 rounded border border-[var(--border-default)] bg-white p-2 text-[var(--ink-secondary)] italic dark:bg-black/30">
                      &ldquo;{line.reasonDetail}&rdquo;
                    </p>
                  </div>

                  {line.photoUrls.length > 0 && (
                    <div>
                      <span className="mb-1.5 block font-semibold text-[var(--ink-secondary)]">
                        Ảnh chụp bằng chứng hiện trường:
                      </span>
                      <div className="flex gap-2">
                        {line.photoUrls.map((pUrl, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative h-20 w-20 overflow-hidden rounded-md border border-[var(--border-default)]"
                          >
                            <Image
                              src={pUrl}
                              alt="Bằng chứng lỗi"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Admin Note Input */}
              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Ý kiến thẩm định & Chỉ đạo xử lý của Quản lý:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú kết luận phê duyệt hoặc lý do từ chối cụ thể..."
                  value={adminNote}
                  onChange={(e) => {
                    setAdminNote(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)]"
                />
              </div>

              {selectedRma.returnAuthCode && (
                <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:bg-emerald-950/40">
                  <div>
                    <span className="block text-[11px] text-emerald-800 dark:text-emerald-300">
                      Mã ủy quyền thu hồi:
                    </span>
                    <strong className="font-mono text-sm text-emerald-900 dark:text-emerald-200">
                      {selectedRma.returnAuthCode}
                    </strong>
                  </div>
                  <button
                    onClick={() => setShowLabelModal(selectedRma)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>In nhãn thu hồi</span>
                  </button>
                </div>
              )}

              {/* Inline Reject Validation Error */}
              {rejectError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{rejectError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRma(null)}
                  className="rounded-md border border-[var(--border-default)] px-3 py-1.5 font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
                >
                  Đóng
                </button>

                {selectedRma.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(selectedRma)}
                      className="flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 shadow-xs hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Từ chối RMA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedRma)}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Phê duyệt & Cấp mã thu hồi</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && (
        <ShippingLabelModal rma={showLabelModal} onClose={() => setShowLabelModal(null)} />
      )}
    </div>
  );
}

function ShippingLabelModal({ rma, onClose }: { rma: RmaRequest; onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-[var(--ink-primary)]">
              Tem Vận Chuyển Thu Hồi Hàng Trả (Return Shipping Label)
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng xem trước nhãn"
            className="rounded p-1 text-[var(--ink-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Label Card */}
        <div
          id="rma-shipping-label"
          className="space-y-3 rounded-lg border-2 border-dashed border-gray-400 bg-white p-5 font-sans text-gray-900 shadow-xs"
        >
          <div className="flex items-start justify-between border-b border-gray-300 pb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  STOCKFLOW LOGISTICS
                </span>
                <span className="text-[10px] font-semibold text-gray-600">REVERSE LOGISTICS</span>
              </div>
              <div className="mt-1 font-mono text-xs font-bold text-emerald-800">
                ỦY QUYỀN RMA: {rma.returnAuthCode || "RMA-AUTH-2026-PENDING"}
              </div>
            </div>
            <div className="text-right">
              <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-rose-700 uppercase">
                {rma.type === "EXCHANGE" ? "THU HỒI ĐỔI MỚI" : "THU HỒI HOÀN TIỀN"}
              </span>
              <div className="mt-1 font-mono text-[10px] text-gray-500">{rma.orderCode}</div>
            </div>
          </div>

          {/* Sender & Recipient addresses */}
          <div className="grid grid-cols-2 gap-3 border-b border-gray-300 pb-3 text-xs">
            <div className="rounded bg-gray-50 p-2.5">
              <span className="block text-[10px] font-bold text-gray-500 uppercase">
                NGƯỜI GỬI (KHÁCH HÀNG):
              </span>
              <div className="mt-0.5 font-bold text-gray-900">{rma.customerName}</div>
              <div className="mt-0.5 font-mono text-[11px] text-gray-600">{rma.customerPhone}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-gray-500">
                Đơn hàng gốc: {rma.orderCode}
              </div>
            </div>
            <div className="rounded bg-gray-50 p-2.5">
              <span className="block text-[10px] font-bold text-gray-500 uppercase">
                NGƯỜI NHẬN (TRUNG TÂM RMA):
              </span>
              <div className="mt-0.5 font-bold text-gray-900">Kho Thu Hồi StockFlow HCM</div>
              <div className="mt-0.5 font-mono text-[11px] text-gray-600">Hotline: 1900 6868</div>
              <div className="mt-0.5 text-[10px] leading-tight text-gray-500">
                Lô T2-4, Đường D1, Khu Công nghệ Cao, TP. Thủ Đức, TP.HCM
              </div>
            </div>
          </div>

          {/* Items to Return */}
          <div className="space-y-1 border-b border-gray-300 pb-2 text-xs">
            <div className="text-[10px] font-bold text-gray-500 uppercase">
              DANH MỤC HÀNG THU HỒI:
            </div>
            {rma.lines.map((line, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <span className="max-w-[280px] truncate font-medium text-gray-800">
                  {line.productName} ({line.sku})
                </span>
                <span className="font-mono font-bold text-gray-900 tabular-nums">
                  {line.returnQty.toLocaleString()} cái
                </span>
              </div>
            ))}
          </div>

          {/* Barcode Visual */}
          <div className="flex flex-col items-center justify-center pt-1 text-center">
            <div className="flex w-full justify-center py-1">
              <svg className="h-12 w-64" viewBox="0 0 256 48">
                {[
                  2, 4, 1, 3, 2, 5, 1, 4, 3, 2, 1, 5, 2, 3, 4, 1, 2, 3, 5, 1, 2, 4, 3, 1, 5, 2, 4,
                  1, 3, 2, 1, 4,
                ].map((w, i) => (
                  <rect key={i} x={i * 8} y={0} width={w} height={40} fill="#111827" />
                ))}
              </svg>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold tracking-widest text-gray-900">
              *{rma.returnAuthCode || rma.rmaCode}*
            </div>
            <p className="mt-1 text-[9px] text-gray-500">
              Dán tem này bên ngoài thùng hàng đóng gói kín. Xuất trình mã vạch cho shipper khi bàn
              giao.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
          <span className="text-[11px] text-[var(--ink-tertiary)]">
            Hỗ trợ máy in tem nhiệt hoặc in giấy A4
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>In nhãn ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
