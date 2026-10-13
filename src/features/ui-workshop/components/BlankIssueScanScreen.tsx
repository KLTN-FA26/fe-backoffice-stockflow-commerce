"use client";

import { useState, useRef, useEffect } from "react";
import {
  Barcode,
  Scan,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  History,
  XCircle,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { workshopRepo } from "../mock-repo";

interface Props {
  onRefresh: () => void;
  onNavigateToKanban?: () => void;
}

interface ScanLogItem {
  id: string;
  timestamp: string;
  barcode: string;
  quantity: number;
  status: "SUCCESS" | "FAILED";
  message: string;
}

// Hàm hỗ trợ lấy thời gian thực ngoài component để đảm bảo tính thuần (pure) cho render
function getNowTimestamp(): number {
  return Date.now();
}

export function BlankIssueScanScreen({ onRefresh, onNavigateToKanban }: Props) {
  const readyOrders = workshopRepo.getOrders({ status: "Ready" });
  const [selectedLsxId, setSelectedLsxId] = useState<string>(readyOrders[0]?.id || "");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanQty, setScanQty] = useState<number>(500);
  const [scanMessage, setScanMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanLogItem[]>([]);

  // Ref để tự động trả con trỏ focus về ô quét mã vạch sau mỗi lượt quét
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Chống quét lặp quá nhanh (Accidental double scan within 2s)
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  const selectedOrder = workshopRepo.getOrderById(selectedLsxId) || readyOrders[0];

  // Tự động focus vào ô quét mã vạch khi chọn LSX
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [selectedLsxId]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const trimmedBarcode = barcodeInput.trim();
    const timestampStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // 1. Kiểm tra mã vạch rỗng
    if (!trimmedBarcode) {
      setScanMessage({
        type: "error",
        text: "Vui lòng quét hoặc nhập mã vạch phôi trên thùng hàng trước khi xác nhận!",
      });
      barcodeInputRef.current?.focus();
      return;
    }

    // 2. Kiểm tra số lượng hợp lệ (Positive finite integer)
    const qty = Number(scanQty);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      setScanMessage({
        type: "error",
        text: "Số lượng xuất phôi phải là số nguyên dương lớn hơn 0!",
      });
      barcodeInputRef.current?.focus();
      return;
    }

    // 3. Kiểm tra chống quét trùng lặp bất thường trong 2 giây (Duplicate rapid scan)
    const now = getNowTimestamp();
    if (lastScanRef.current.code === trimmedBarcode && now - lastScanRef.current.time < 2000) {
      setScanMessage({
        type: "error",
        text: `⚠️ Cảnh báo quét trùng: Mã vạch "${trimmedBarcode}" vừa được quét thành công. Vui lòng kiểm tra lại để tránh ghi nhận 2 lần.`,
      });
      barcodeInputRef.current?.focus();
      return;
    }

    // 4. Xác thực và xuất phôi qua Mock Barcode Registry (Chống khớp substring giả mạo, kiểm tra Lô/Vị trí/Tồn kho/SKU)
    const result = workshopRepo.issueBlanksWithBarcode(selectedOrder.id, trimmedBarcode, qty);

    if (result.success && result.resolvedBarcode) {
      lastScanRef.current = { code: trimmedBarcode, time: now };
      setScanMessage({
        type: "success",
        text:
          result.message ||
          `Quét xuất phôi thành công! Lô: ${result.resolvedBarcode.lotNumber} | Vị trí: ${result.resolvedBarcode.warehouseLocation}`,
      });
      setBarcodeInput("");

      setScanHistory((prev) => [
        {
          id: `scan-${getNowTimestamp()}`,
          timestamp: timestampStr,
          barcode: trimmedBarcode,
          quantity: qty,
          status: "SUCCESS",
          message: `Lô ${result.resolvedBarcode?.lotNumber} (${result.resolvedBarcode?.warehouseLocation}) +${qty.toLocaleString()} phôi`,
        },
        ...prev.slice(0, 9),
      ]);

      const remainingRequired =
        selectedOrder.plannedQuantity - (selectedOrder.scannedBlanksQuantity + qty);
      setScanQty(remainingRequired > 0 ? Math.min(500, remainingRequired) : 0);

      onRefresh();
    } else {
      const errorText = result.error || "Lỗi quét mã vạch không xác định!";
      setScanMessage({
        type: "error",
        text: errorText,
      });

      setScanHistory((prev) => [
        {
          id: `scan-${getNowTimestamp()}`,
          timestamp: timestampStr,
          barcode: trimmedBarcode,
          quantity: qty,
          status: "FAILED",
          message: errorText.length > 55 ? `${errorText.substring(0, 52)}...` : errorText,
        },
        ...prev.slice(0, 9),
      ]);

      barcodeInputRef.current?.select();
      barcodeInputRef.current?.focus();
    }

    // Luôn trả con trỏ về ô input để nhân viên kho quét tiếp thùng tiếp theo
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  const handleQuickFillBarcode = (barcode: string) => {
    setBarcodeInput(barcode);
    barcodeInputRef.current?.focus();
  };

  const handleUndoLastScan = () => {
    const lastSuccess = scanHistory.find((s) => s.status === "SUCCESS" && s.quantity > 0);
    if (!lastSuccess || !selectedOrder) return;

    if (selectedOrder.scannedBlanksQuantity <= 0) return;

    const rollbackQty = Math.min(lastSuccess.quantity, selectedOrder.scannedBlanksQuantity);
    const rollbackResult = workshopRepo.rollbackIssuedBlanks(
      selectedOrder.id,
      rollbackQty,
      lastSuccess.barcode,
    );

    const timestampStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setScanHistory((prev) => [
      {
        id: `undo-${getNowTimestamp()}`,
        timestamp: timestampStr,
        barcode: lastSuccess.barcode,
        quantity: -rollbackQty,
        status: "SUCCESS",
        message: `Hoàn tác lượt quét: Trừ -${rollbackQty.toLocaleString()} phôi (Khôi phục số lượng)`,
      },
      ...prev.slice(0, 9),
    ]);

    setScanMessage({
      type: "success",
      text:
        rollbackResult.message ||
        `Đã hoàn tác lượt quét (${lastSuccess.barcode}). Giảm -${rollbackQty.toLocaleString()} phôi khỏi lệnh ${selectedOrder.code}.`,
    });

    const updatedScanned = selectedOrder.scannedBlanksQuantity - rollbackQty;
    const remaining = selectedOrder.plannedQuantity - updatedScanned;
    setScanQty(remaining > 0 ? Math.min(500, remaining) : 0);
    onRefresh();
  };

  const remainingQuantity = selectedOrder
    ? Math.max(0, selectedOrder.plannedQuantity - selectedOrder.scannedBlanksQuantity)
    : 0;

  const progressPercent = selectedOrder
    ? Math.min(
        100,
        Math.round((selectedOrder.scannedBlanksQuantity / selectedOrder.plannedQuantity) * 100),
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <Scan className="h-5 w-5 text-[var(--accent)]" />
          <span>Quét Xuất Phôi Sản Xuất (Issue Blanks to Production — SCRUM-410)</span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Thủ kho quét mã vạch xuất phôi từ kệ lưu trữ sang khu vực sản xuất. Kiểm soát định mức
          phôi và chống xuất sai SKU (BR-PRD-03).
        </p>
      </div>

      {/* Main Scanner Box */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Select LSX & Info */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
            1. Chọn Lệnh sản xuất cần xuất phôi
          </h3>

          <div>
            <label className="mb-1 block text-xs text-[var(--ink-secondary)]">
              Danh sách LSX ở trạng thái Ready:
            </label>
            <select
              value={selectedLsxId}
              onChange={(e) => {
                setSelectedLsxId(e.target.value);
                setScanMessage(null);
              }}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-2 font-mono text-xs font-medium text-[var(--ink-primary)]"
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
            <div className="space-y-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Khách hàng:</span>
                <span className="font-medium text-[var(--ink-primary)]">
                  {selectedOrder.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Mã phôi SKU:</span>
                <span className="font-mono font-bold text-[var(--ink-primary)]">
                  {selectedOrder.blankSku}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Tên loại phôi:</span>
                <span className="max-w-[180px] truncate font-medium">
                  {selectedOrder.blankName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Vị trí lưu kho:</span>
                <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                  Kệ B-04-01 (Tồn: 12,000)
                </span>
              </div>
              <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                <span className="text-[var(--ink-secondary)]">Nhu cầu kế hoạch:</span>
                <span className="font-mono font-bold text-[var(--ink-primary)]">
                  {selectedOrder.plannedQuantity.toLocaleString()} phôi
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Đã xuất vào chuyền:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedOrder.scannedBlanksQuantity.toLocaleString()} phôi
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Số lượng còn thiếu:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {remainingQuantity.toLocaleString()} phôi
                </span>
              </div>
            </div>
          )}

          {/* Helper sample barcodes for testing */}
          {selectedOrder && (
            <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] p-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-[var(--ink-primary)]">
                <HelpCircle className="h-3.5 w-3.5 text-[var(--ink-secondary)]" />
                <span>Mẫu mã vạch thử nghiệm:</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickFillBarcode("BC-TO-750-LOT2601-LOC-B04")}
                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-left font-mono text-[11px] text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  🟢 Hợp lệ (Lô 1): BC-TO-750-LOT2601-LOC-B04 (Tồn: 15k)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillBarcode("BC-TO-750-LOT2602-LOC-B05")}
                  className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-left font-mono text-[11px] text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  🟢 Hợp lệ (Lô 2): BC-TO-750-LOT2602-LOC-B05 (Tồn: 3k)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillBarcode("BC-TO-GIAY-750-KRAFT-FABRICATED")}
                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-left font-mono text-[11px] text-rose-800 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  🔴 Mã bịa (chứa SKU): BC-TO-GIAY-750-KRAFT-FABRICATED
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillBarcode("BC-LY-500-LOT2601-LOC-A01")}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-left font-mono text-[11px] text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  🟡 Khác SKU (Ly 500ml): BC-LY-500-LOT2601-LOC-A01
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillBarcode("BC-TO-750-DEPLETED-LOT99")}
                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-left font-mono text-[11px] text-rose-800 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  🔴 Lô cạn kiệt (Tồn = 0): BC-TO-750-DEPLETED-LOT99
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center/Right: Live Barcode Scan Box & History */}
        <div className="flex flex-col justify-between space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs lg:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
                <Barcode className="h-4 w-4 text-[var(--accent)]" />
                <span>2. Bàn quét mã vạch thùng phôi (Barcode Scanner Simulator)</span>
              </h3>
              <span className="font-mono text-xs font-semibold text-[var(--ink-secondary)]">
                Tiến độ: {progressPercent}% ({selectedOrder?.scannedBlanksQuantity.toLocaleString()}{" "}
                / {selectedOrder?.plannedQuantity.toLocaleString()})
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
            <form onSubmit={handleScanSubmit} noValidate className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                    Quét hoặc nhập mã vạch phôi (Nhấn Enter để gửi):
                  </label>
                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      data-testid="barcode-input"
                      type="text"
                      placeholder={
                        selectedOrder ? `BC-${selectedOrder.blankSku}-LOT01` : "Quét mã vạch..."
                      }
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      disabled={!selectedOrder || selectedOrder.isBlanksCompleted}
                      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 font-mono text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                    Số lượng phôi / lượt quét:
                  </label>
                  <input
                    data-testid="qty-input"
                    type="number"
                    min="1"
                    max={remainingQuantity || 1}
                    value={scanQty}
                    onChange={(e) => setScanQty(Number(e.target.value))}
                    disabled={!selectedOrder || selectedOrder.isBlanksCompleted}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 font-mono text-xs font-bold text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-hidden disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={
                    !selectedOrder || selectedOrder.isBlanksCompleted || remainingQuantity <= 0
                  }
                  className="rounded-md bg-[var(--brand)] px-4 py-2 text-xs font-medium text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50"
                >
                  Xác nhận quét mã (+{scanQty} phôi)
                </button>
              </div>
            </form>

            {/* Notification message */}
            {scanMessage && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-md p-3 text-xs ${
                  scanMessage.type === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {scanMessage.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                <span className="leading-relaxed font-medium">{scanMessage.text}</span>
              </div>
            )}

            {/* Scan History Log Table */}
            <div className="mt-6 border-t border-[var(--border-default)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-primary)]">
                  <History className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" />
                  <span>Nhật ký các lượt quét gần nhất (Scan Log):</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                    {scanHistory.length} lượt
                  </span>
                  {scanHistory.some((s) => s.status === "SUCCESS" && s.quantity > 0) && (
                    <button
                      type="button"
                      onClick={handleUndoLastScan}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-secondary)] transition-colors hover:border-amber-300 hover:text-amber-700"
                      title="Hoàn tác lượt quét phôi thành công gần nhất nếu quét nhầm số lượng"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Hoàn tác lượt gần nhất</span>
                    </button>
                  )}
                </div>
              </div>

              {scanHistory.length === 0 ? (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-center text-xs text-[var(--ink-tertiary)]">
                  Chưa có lượt quét nào trong phiên làm việc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-[var(--border-default)]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] font-medium text-[var(--ink-secondary)]">
                      <tr>
                        <th className="px-2.5 py-1.5">Thời gian</th>
                        <th className="px-2.5 py-1.5">Mã vạch quét</th>
                        <th className="px-2.5 py-1.5 text-right">Số lượng</th>
                        <th className="px-2.5 py-1.5">Kết quả</th>
                        <th className="px-2.5 py-1.5">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)] font-mono text-[11px]">
                      {scanHistory.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.status === "FAILED" ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                          }
                        >
                          <td className="px-2.5 py-1.5 text-[var(--ink-tertiary)]">
                            {item.timestamp}
                          </td>
                          <td className="px-2.5 py-1.5 font-bold text-[var(--ink-primary)]">
                            {item.barcode}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-bold">
                            {item.status === "SUCCESS" ? `+${item.quantity}` : "0"}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {item.status === "SUCCESS" ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>THÀNH CÔNG</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                                <XCircle className="h-3 w-3" />
                                <span>TỪ CHỐI</span>
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 font-sans text-[var(--ink-secondary)]">
                            {item.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Success footer if completed */}
          {selectedOrder && selectedOrder.isBlanksCompleted && (
            <div className="flex flex-col items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-100 p-4 text-xs text-emerald-900 sm:flex-row dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>
                  <strong>ĐÃ HOÀN TẤT XUẤT PHÔI:</strong> Lệnh sản xuất đã tự động chuyển sang trạng
                  thái <strong>Material Issued</strong>. Sẵn sàng lên máy in!
                </span>
              </div>
              {onNavigateToKanban && (
                <button
                  onClick={onNavigateToKanban}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800"
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
