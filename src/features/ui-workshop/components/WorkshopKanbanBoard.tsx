"use client";

import { useState } from "react";
import { 
  Printer, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  Layers, 
  RotateCcw,
  Check
} from "lucide-react";
import { WorkshopLSX, WorkshopLsxStatus } from "../types";
import { workshopRepo } from "../mock-repo";

interface Props {
  onRefresh: () => void;
  onNavigateToQc?: (order: WorkshopLSX) => void;
}

export function WorkshopKanbanBoard({ onRefresh, onNavigateToQc }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<WorkshopLSX | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [machineId, setMachineId] = useState("FLEXO-01");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [goodQty, setGoodQty] = useState(1000);
  const [scrapQty, setScrapQty] = useState(20);
  const [scrapReason, setScrapReason] = useState("");

  const orders = workshopRepo.getOrders();

  const columns: { status: WorkshopLsxStatus; label: string; color: string }[] = [
    { status: "Ready", label: "Chờ xuất phôi (Ready)", color: "border-teal-500" },
    { status: "Material Issued", label: "Đã xuất phôi (Chờ in)", color: "border-sky-500" },
    { status: "Printing", label: "Đang in (Printing)", color: "border-indigo-500" },
    { status: "QC", label: "Kiểm tra chất lượng (QC)", color: "border-purple-500" },
  ];

  const handleStartPrintSubmit = () => {
    if (!selectedOrder) return;
    workshopRepo.startPrint(selectedOrder.id, machineId);
    setShowStartModal(false);
    onRefresh();
  };

  const handleRecordOutputSubmit = () => {
    if (!selectedOrder) return;
    if (scrapQty > 0 && !scrapReason.trim()) {
      alert("BR-PRD-04: Phôi hỏng (phế phẩm) bắt buộc phải có lý do điều chỉnh kho.");
      return;
    }
    workshopRepo.recordPrintOutput(selectedOrder.id, goodQty, scrapQty, scrapReason);
    setShowRecordModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--accent)]" />
            <span>Bảng Kanban Xưởng Sản Xuất (Workshop Kanban Board — SCRUM-417)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý dòng chảy công việc từ phôi đến máy in và trạm kiểm định QC (BR-PRD-04: ghi nhận phế phẩm kèm lý do).
          </p>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              className={`flex flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs min-h-[480px]`}
            >
              {/* Column Header */}
              <div className={`p-3 border-b-2 ${col.color} bg-[var(--bg-subtle)] flex items-center justify-between`}>
                <span className="font-semibold text-xs text-[var(--ink-primary)]">{col.label}</span>
                <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-mono font-bold text-[var(--ink-secondary)]">
                  {colOrders.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                {colOrders.length === 0 ? (
                  <div className="py-12 text-center text-[11px] text-[var(--ink-tertiary)] italic">
                    Không có LSX nào ở cột này
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 shadow-xs hover:border-[var(--border-strong)] transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[var(--ink-primary)]">{order.code}</span>
                        {order.type === "SAMPLE" ? (
                          <span className="rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.2 text-[10px] font-bold">
                            MẪU
                          </span>
                        ) : (
                          <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-bold">
                            ĐƠN HÀNG
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-medium text-[var(--ink-primary)] truncate">{order.customerName}</div>
                        <div className="text-[11px] font-mono text-[var(--ink-secondary)]">{order.blankSku}</div>
                      </div>

                      <div className="rounded bg-[var(--bg-subtle)] p-2 text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[var(--ink-tertiary)]">Kế hoạch:</span>
                          <span className="font-mono font-bold">{order.plannedQuantity.toLocaleString()}</span>
                        </div>
                        {order.machineId && (
                          <div className="flex justify-between">
                            <span className="text-[var(--ink-tertiary)]">Máy in:</span>
                            <span className="font-mono text-indigo-600 font-semibold">{order.machineId}</span>
                          </div>
                        )}
                        {(order.printedGoodQuantity > 0 || order.printedScrapQuantity > 0) && (
                          <div className="flex justify-between border-t border-[var(--border-default)] pt-1 mt-1">
                            <span className="text-[var(--ink-tertiary)]">Đạt / Phế:</span>
                            <span className="font-mono">
                              <strong className="text-emerald-600">{order.printedGoodQuantity}</strong> /{" "}
                              <strong className="text-rose-600">{order.printedScrapQuantity}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between">
                        <span className="text-[10px] text-[var(--ink-tertiary)] font-mono">{order.dueDate}</span>

                        {order.status === "Material Issued" && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowStartModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 shadow-xs"
                          >
                            <Play className="h-3 w-3" />
                            <span>Lên máy in</span>
                          </button>
                        )}

                        {order.status === "Printing" && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowRecordModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-[var(--brand)] px-2 py-1 text-[11px] font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
                          >
                            <Check className="h-3 w-3" />
                            <span>Ghi nhận SL</span>
                          </button>
                        )}

                        {order.status === "QC" && onNavigateToQc && (
                          <button
                            onClick={() => onNavigateToQc(order)}
                            className="inline-flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-purple-700 shadow-xs"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Mở QC</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Start Print */}
      {showStartModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>Gán máy in & Bắt đầu in: {selectedOrder.code}</span>
            </h3>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1">Chọn máy in trong xưởng:</label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-medium"
              >
                <option value="FLEXO-01">Máy in Flexo UV 01 (In ly giấy tốc độ cao)</option>
                <option value="FLEXO-02">Máy in Flexo UV 02 (In tô & hộp Kraft)</option>
                <option value="SCREEN-01">Máy in Lưới bán tự động 01 (In ly nhựa PP/PET)</option>
                <option value="DIGITAL-01">Máy in Kỹ thuật số UV Flatbed 01 (In mẫu thử)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowStartModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleStartPrintSubmit}
                className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700 shadow-xs"
              >
                Bắt đầu in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Record Print Output */}
      {showRecordModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-xs">
            <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Ghi nhận sản lượng in & Phế phẩm (BR-PRD-04)</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[var(--ink-secondary)] mb-1 font-medium">SL In đạt (Tốt):</label>
                <input
                  type="number"
                  min="0"
                  value={goodQty}
                  onChange={(e) => setGoodQty(Number(e.target.value))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                />
              </div>
              <div>
                <label className="block text-[var(--ink-secondary)] mb-1 font-medium">SL Phôi hỏng (Phế):</label>
                <input
                  type="number"
                  min="0"
                  value={scrapQty}
                  onChange={(e) => setScrapQty(Number(e.target.value))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-rose-700 dark:text-rose-400"
                />
              </div>
            </div>

            {scrapQty > 0 && (
              <div>
                <label className="block text-[var(--ink-primary)] mb-1 font-semibold">
                  Lý do phế phẩm (* bắt buộc điều chỉnh kho BR-PRD-04):
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ví dụ: Lệch màu lúc canh bo trục, kẹt phôi máy dập viền..."
                  value={scrapReason}
                  onChange={(e) => setScrapReason(e.target.value)}
                  className="w-full rounded border border-rose-300 dark:border-rose-900 bg-[var(--bg-subtle)] p-2 text-xs"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowRecordModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleRecordOutputSubmit}
                className="rounded bg-[var(--brand)] px-3 py-1.5 font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
              >
                Xác nhận & Chuyển sang QC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
