"use client";

import { useState } from "react";
import { 
  Barcode, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { WorkshopLSX } from "../types";
import { workshopRepo } from "../mock-repo";

interface Props {
  onRefresh: () => void;
  onNavigateToKanban?: () => void;
}

export function BlankIssueScanScreen({ onRefresh, onNavigateToKanban }: Props) {
  const readyOrders = workshopRepo.getOrders({ status: "Ready" });
  const [selectedLsxId, setSelectedLsxId] = useState<string>(readyOrders[0]?.id || "");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanQty, setScanQty] = useState<number>(500);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedOrder = workshopRepo.getOrderById(selectedLsxId) || readyOrders[0];

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const result = workshopRepo.scanBlanks(selectedOrder.id, Number(scanQty));
    if (result.success) {
      setScanMessage({ type: "success", text: result.message });
      setBarcodeInput("");
      onRefresh();
    } else {
      setScanMessage({ type: "error", text: result.message });
    }
  };

  const handleQuickScanAll = () => {
    if (!selectedOrder) return;
    const remaining = selectedOrder.plannedQuantity - selectedOrder.scannedBlanksQuantity;
    const result = workshopRepo.scanBlanks(selectedOrder.id, remaining);
    if (result.success) {
      setScanMessage({ type: "success", text: result.message });
      onRefresh();
    }
  };

  const progressPercent = selectedOrder
    ? Math.min(100, Math.round((selectedOrder.scannedBlanksQuantity / selectedOrder.plannedQuantity) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-[var(--ink-primary)] flex items-center gap-2">
          <Scan className="h-5 w-5 text-[var(--accent)]" />
          <span>Quét Xuất Phôi Sản Xuất (Issue Blanks to Production — SCRUM-410)</span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Thủ kho quét mã vạch xuất phôi từ kệ lưu trữ sang khu vực sản xuất. Hệ thống kiểm soát chống xuất vượt định mức (BR-PRD-03).
        </p>
      </div>

      {/* Main Scanner Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Select LSX & Info */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">1. Chọn Lệnh sản xuất cần xuất phôi</h3>

          <div>
            <label className="block text-xs text-[var(--ink-secondary)] mb-1">Danh sách LSX ở trạng thái Ready:</label>
            <select
              value={selectedLsxId}
              onChange={(e) => {
                setSelectedLsxId(e.target.value);
                setScanMessage(null);
              }}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-2 text-xs font-mono font-medium text-[var(--ink-primary)]"
            >
              {readyOrders.length === 0 ? (
                <option value="">Không có LSX nào chờ xuất phôi</option>
              ) : (
                readyOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.blankSku} ({o.plannedQuantity.toLocaleString()} cái)
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedOrder && (
            <div className="space-y-2.5 rounded-md bg-[var(--bg-subtle)] p-3 border border-[var(--border-default)] text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Khách hàng:</span>
                <span className="font-medium text-[var(--ink-primary)]">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Mã phôi SKU:</span>
                <span className="font-mono font-bold text-[var(--ink-primary)]">{selectedOrder.blankSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Tên loại phôi:</span>
                <span className="font-medium truncate max-w-[180px]">{selectedOrder.blankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Nhu cầu phôi LSX:</span>
                <span className="font-mono font-bold text-[var(--accent)]">{selectedOrder.plannedQuantity.toLocaleString()} phôi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Hiện đã xuất:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedOrder.scannedBlanksQuantity.toLocaleString()} phôi
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Live Barcode Scan Box */}
        <div className="lg:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
                <Barcode className="h-4 w-4 text-[var(--accent)]" />
                <span>2. Bàn quét mã vạch thùng phôi (Barcode Scanner Simulator)</span>
              </h3>
              <span className="text-xs font-mono font-semibold text-[var(--ink-secondary)]">
                Tiến độ: {progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Scan Form */}
            <form onSubmit={handleScanSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1">
                    Quét hoặc nhập mã vạch phôi:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={selectedOrder ? `BC-${selectedOrder.blankSku}-LOT01` : "Quét mã vạch..."}
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-mono text-[var(--ink-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1">
                    Số lượng phôi / lượt quét:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={scanQty}
                    onChange={(e) => setScanQty(Number(e.target.value))}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-mono font-bold text-[var(--ink-primary)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={!selectedOrder || selectedOrder.isBlanksCompleted}
                  className="rounded-md bg-[var(--brand)] px-4 py-2 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs transition-colors disabled:opacity-50"
                >
                  Xác nhận quét phôi (+{scanQty})
                </button>
                <button
                  type="button"
                  onClick={handleQuickScanAll}
                  disabled={!selectedOrder || selectedOrder.isBlanksCompleted}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
                >
                  Quét nhanh toàn bộ số lượng còn lại
                </button>
              </div>
            </form>

            {/* Notification message */}
            {scanMessage && (
              <div
                className={`mt-4 rounded-md p-3 text-xs flex items-start gap-2 ${
                  scanMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200"
                }`}
              >
                {scanMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{scanMessage.text}</span>
              </div>
            )}
          </div>

          {/* Success footer if completed */}
          {selectedOrder && selectedOrder.isBlanksCompleted && (
            <div className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 p-4 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  <strong>ĐÃ HOÀN TẤT XUẤT PHÔI:</strong> Lệnh sản xuất đã tự động chuyển sang trạng thái <strong>Material Issued</strong>. Sẵn sàng lên máy in!
                </span>
              </div>
              {onNavigateToKanban && (
                <button
                  onClick={onNavigateToKanban}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 shrink-0 flex items-center gap-1"
                >
                  <span>Mở bảng Kanban xưởng</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
