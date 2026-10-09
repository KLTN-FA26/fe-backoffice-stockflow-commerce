"use client";

import { useState } from "react";
import { 
  PackageCheck, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Truck,
  Box
} from "lucide-react";
import { WorkshopLSX } from "../types";
import { workshopRepo } from "../mock-repo";

interface Props {
  onRefresh: () => void;
}

export function CompletedHandoffList({ onRefresh }: Props) {
  const completedOrders = workshopRepo.getOrders({ status: "Completed" });
  const [selectedOrder, setSelectedOrder] = useState<WorkshopLSX | null>(null);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [actorName, setActorName] = useState("Hoàng Minh (Trưởng ca xưởng)");
  const [notes, setNotes] = useState("");

  const handleHandoffSubmit = () => {
    if (!selectedOrder) return;
    workshopRepo.confirmHandoffToPacking(selectedOrder.id, actorName);
    setShowHandoffModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink-primary)] flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            <span>Danh Sách Hoàn Thành & Bàn Giao Đóng Gói (Completion & Hand-off — SCRUM-412)</span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Xác nhận bàn giao thành phẩm từ khu vực Sản xuất (PRODUCTION) sang khu vực Đóng gói (PACKING) theo quy chuẩn BR-PRD-06.
          </p>
        </div>

        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs">
          <span className="text-[var(--ink-secondary)]">Tổng LSX Hoàn thành: </span>
          <strong className="font-mono text-emerald-600 dark:text-emerald-400">{completedOrders.length}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] font-medium">
            <tr>
              <th className="py-2.5 px-3">Mã LSX</th>
              <th className="py-2.5 px-3">Khách hàng / Đơn</th>
              <th className="py-2.5 px-3">Sản phẩm / Phôi</th>
              <th className="py-2.5 px-3 text-right">SL Thành phẩm đạt QC</th>
              <th className="py-2.5 px-3">Trạng thái bàn giao PACKING</th>
              <th className="py-2.5 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {completedOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--ink-tertiary)]">
                  Chưa có lệnh sản xuất nào hoàn thành.
                </td>
              </tr>
            ) : (
              completedOrders.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink-primary)]">
                    {o.code}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[var(--ink-primary)]">{o.customerName}</div>
                    <div className="text-[11px] font-mono text-[var(--ink-tertiary)]">{o.orderCode || "Mẫu thử"}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono">{o.blankSku}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)]">{o.blankName}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {o.qcPassedQuantity.toLocaleString()} cái
                  </td>
                  <td className="py-2.5 px-3">
                    {o.isHandedOffToPacking ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Đã chuyển PACKING</span>
                        </span>
                        <div className="text-[10px] text-[var(--ink-tertiary)] mt-0.5 font-mono">
                          {o.handedOffAt} · {o.handedOffBy}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                        <Clock className="h-3 w-3" />
                        <span>Chờ bàn giao</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {!o.isHandedOffToPacking && (
                      <button
                        onClick={() => {
                          setSelectedOrder(o);
                          setShowHandoffModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 shadow-xs"
                      >
                        <Box className="h-3 w-3" />
                        <span>Bàn giao đóng gói</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Handoff */}
      {showHandoffModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-xs">
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              <span>Xác nhận Bàn giao Thành phẩm sang Đóng gói (PACKING)</span>
            </h3>

            <div className="rounded bg-[var(--bg-subtle)] p-3 border border-[var(--border-default)] space-y-1">
              <div>Lệnh sản xuất: <strong className="font-mono">{selectedOrder.code}</strong></div>
              <div>Số lượng chuyển giao: <strong className="font-mono text-emerald-600">{selectedOrder.qcPassedQuantity.toLocaleString()} sản phẩm đạt chuẩn</strong></div>
              <div>Khách hàng: <strong>{selectedOrder.customerName}</strong></div>
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1">Người bàn giao (Đại diện xưởng):</label>
              <input
                type="text"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1">Ghi chú bàn giao đóng gói (tùy chọn):</label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Đóng thùng 50 cái/thùng, bọc màng co PE..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowHandoffModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleHandoffSubmit}
                className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 shadow-xs"
              >
                Xác nhận chuyển PACKING
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
