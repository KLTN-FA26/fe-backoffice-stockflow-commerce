"use client";

import { useState } from "react";
import { Printer, Play, CheckCircle2, Layers, Check, AlertCircle } from "lucide-react";
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
  const [recordError, setRecordError] = useState<string | null>(null);

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
      setRecordError("BR-PRD-04: Phôi hỏng (phế phẩm) bắt buộc phải có lý do điều chỉnh kho!");
      return;
    }
    setRecordError(null);
    workshopRepo.recordPrintOutput(selectedOrder.id, goodQty, scrapQty, scrapReason);
    setShowRecordModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
            <Layers className="h-5 w-5 text-[var(--accent)]" />
            <span>Bảng Kanban Xưởng Sản Xuất (Workshop Kanban Board — SCRUM-417)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý dòng chảy công việc từ phôi đến máy in và trạm kiểm định QC (BR-PRD-04: ghi nhận
            phế phẩm kèm lý do).
          </p>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              className={`flex min-h-[480px] flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs`}
            >
              {/* Column Header */}
              <div
                className={`border-b-2 p-3 ${col.color} flex items-center justify-between bg-[var(--bg-subtle)]`}
              >
                <span className="text-xs font-semibold text-[var(--ink-primary)]">{col.label}</span>
                <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--ink-secondary)]">
                  {colOrders.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="max-h-[600px] flex-1 space-y-3 overflow-y-auto p-3">
                {colOrders.length === 0 ? (
                  <div className="py-12 text-center text-[11px] text-[var(--ink-tertiary)] italic">
                    Không có LSX nào ở cột này
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <div
                      key={order.id}
                      className="space-y-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 shadow-xs transition-all hover:border-[var(--border-strong)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--ink-primary)]">
                          {order.code}
                        </span>
                        {order.type === "SAMPLE" ? (
                          <span className="py-0.2 rounded bg-purple-100 px-1.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            MẪU
                          </span>
                        ) : (
                          <span className="py-0.2 rounded bg-blue-100 px-1.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            ĐƠN HÀNG
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="truncate text-xs font-medium text-[var(--ink-primary)]">
                          {order.customerName}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--ink-secondary)]">
                          {order.blankSku}
                        </div>
                      </div>

                      <div className="space-y-1 rounded bg-[var(--bg-subtle)] p-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[var(--ink-tertiary)]">Kế hoạch:</span>
                          <span className="font-mono font-bold">
                            {order.plannedQuantity.toLocaleString()}
                          </span>
                        </div>
                        {order.machineId && (
                          <div className="flex justify-between">
                            <span className="text-[var(--ink-tertiary)]">Máy in:</span>
                            <span className="font-mono font-semibold text-indigo-600">
                              {order.machineId}
                            </span>
                          </div>
                        )}
                        {(order.printedGoodQuantity > 0 || order.printedScrapQuantity > 0) && (
                          <div className="mt-1 flex justify-between border-t border-[var(--border-default)] pt-1">
                            <span className="text-[var(--ink-tertiary)]">Đạt / Phế:</span>
                            <span className="font-mono">
                              <strong className="text-emerald-600">
                                {order.printedGoodQuantity}
                              </strong>{" "}
                              /{" "}
                              <strong className="text-rose-600">
                                {order.printedScrapQuantity}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
                        <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                          {order.dueDate}
                        </span>

                        {order.status === "Material Issued" && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowStartModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-indigo-700"
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
                            className="inline-flex items-center gap-1 rounded bg-[var(--brand)] px-2 py-1 text-[11px] font-medium text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
                          >
                            <Check className="h-3 w-3" />
                            <span>Ghi nhận SL</span>
                          </button>
                        )}

                        {order.status === "QC" && onNavigateToQc && (
                          <button
                            onClick={() => onNavigateToQc(order)}
                            className="inline-flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-purple-700"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-xs shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>Gán máy in & Bắt đầu in: {selectedOrder.code}</span>
            </h3>

            <div>
              <label className="mb-1 block text-[var(--ink-secondary)]">
                Chọn máy in trong xưởng:
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs font-medium"
              >
                <option value="FLEXO-01">Máy in Flexo UV 01 (In ly giấy tốc độ cao)</option>
                <option value="FLEXO-02">Máy in Flexo UV 02 (In tô & hộp Kraft)</option>
                <option value="SCREEN-01">Máy in Lưới bán tự động 01 (In ly nhựa PP/PET)</option>
                <option value="DIGITAL-01">Máy in Kỹ thuật số UV Flatbed 01 (In mẫu thử)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowStartModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleStartPrintSubmit}
                className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white shadow-xs hover:bg-indigo-700"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-xs shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Ghi nhận sản lượng in & Phế phẩm (BR-PRD-04)</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  SL In đạt (Tốt):
                </label>
                <input
                  type="number"
                  min="0"
                  value={goodQty}
                  onChange={(e) => setGoodQty(Number(e.target.value))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  SL Phôi hỏng (Phế):
                </label>
                <input
                  type="number"
                  min="0"
                  value={scrapQty}
                  onChange={(e) => setScrapQty(Number(e.target.value))}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs font-bold text-rose-700 dark:text-rose-400"
                />
              </div>
            </div>

            {scrapQty > 0 && (
              <div>
                <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
                  Lý do phế phẩm (* bắt buộc điều chỉnh kho BR-PRD-04):
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ví dụ: Lệch màu lúc canh bo trục, kẹt phôi máy dập viền..."
                  value={scrapReason}
                  onChange={(e) => {
                    setScrapReason(e.target.value);
                    if (recordError) setRecordError(null);
                  }}
                  className="w-full rounded border border-rose-300 bg-[var(--bg-subtle)] p-2 text-xs dark:border-rose-900"
                />
              </div>
            )}

            {recordError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{recordError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowRecordModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleRecordOutputSubmit}
                className="rounded bg-[var(--brand)] px-3 py-1.5 font-medium text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
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
