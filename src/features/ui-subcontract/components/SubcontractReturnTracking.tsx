"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  PackageCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Plus
} from "lucide-react";
import { SubcontractOrder } from "../types";
import { subcontractRepo } from "../mock-repo";

interface Props {
  subOrder: SubcontractOrder;
  onBack: () => void;
  onRefresh: () => void;
}

export function SubcontractReturnTracking({ subOrder, onBack, onRefresh }: Props) {
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivedGoodQty, setReceivedGoodQty] = useState(
    Math.max(0, subOrder.quantity - subOrder.receivedGoodQuantity)
  );
  const [receivedScrapQty, setReceivedScrapQty] = useState(0);
  const [receiver, setReceiver] = useState("Võ Hoàng Minh (QC Kho StockFlow)");
  const [notes, setNotes] = useState("");

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    subcontractRepo.recordReturn({
      subcontractOrderId: subOrder.id,
      receivedGoodQty: Number(receivedGoodQty),
      receivedScrapQty: Number(receivedScrapQty),
      receiver,
      notes,
    });
    setShowReceiveModal(false);
    onRefresh();
  };

  const progressPercent = Math.min(
    100,
    Math.round((subOrder.receivedGoodQuantity / subOrder.quantity) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-[var(--ink-primary)]">{subOrder.code}</h1>
              <span className="rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-xs font-bold">
                THEO DÕI NHẬN HÀNG GIA CÔNG
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Đối tác gia công: <strong>{subOrder.partnerName}</strong> · Đơn hàng cha: <strong>{subOrder.parentLsxCode}</strong>
            </p>
          </div>
        </div>

        {subOrder.status !== "RECEIVED_COMPLETED" && (
          <button
            onClick={() => setShowReceiveModal(true)}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Ghi nhận nhận hàng & QC</span>
          </button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="text-[var(--ink-secondary)]">Tổng số lượng gửi đi</div>
          <div className="mt-1 text-2xl font-bold font-mono text-[var(--ink-primary)]">
            {subOrder.quantity.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--ink-tertiary)] font-mono">{subOrder.blankSku}</div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-xs">
          <div className="text-emerald-800 dark:text-emerald-300 font-medium">Đã nhận đạt chuẩn (QC Pass)</div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {subOrder.receivedGoodQuantity.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600">
            Đạt {progressPercent}% tổng ủy thác
          </div>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-xs">
          <div className="text-rose-800 dark:text-rose-300 font-medium">Phế phẩm trả về / Hao hụt</div>
          <div className="mt-1 text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
            {subOrder.receivedScrapQuantity.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600">Trừ vào công nợ NCC</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span>Tiến độ hoàn trả từ xưởng ngoài</span>
          <span className="font-mono">{progressPercent}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--bg-muted)] overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Return History Table */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--ink-tertiary)]" />
          <span>Nhật ký các đợt nhận hàng & Biên bản QC</span>
        </h3>

        {subOrder.returnHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--ink-tertiary)] italic">
            Chưa có đợt nhận hàng nào được ghi nhận cho đơn này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)]">
                <tr>
                  <th className="py-2 px-3">Thời gian</th>
                  <th className="py-2 px-3 text-right">SL Đạt</th>
                  <th className="py-2 px-3 text-right">SL Phế</th>
                  <th className="py-2 px-3">Người kiểm định</th>
                  <th className="py-2 px-3">Ghi chú chất lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {subOrder.returnHistory.map((h, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-subtle)]">
                    <td className="py-2.5 px-3 font-mono">{h.timestamp}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{h.receivedQty.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {h.scrapQty}
                    </td>
                    <td className="py-2.5 px-3">{h.receiver}</td>
                    <td className="py-2.5 px-3 text-[var(--ink-secondary)]">{h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Receive Goods */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-xs">
            <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              <span>Ghi nhận Nhận hàng & Kiểm định QC từ xưởng gia công</span>
            </h3>

            <form onSubmit={handleReceiveSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--ink-primary)] font-semibold mb-1">
                    Số lượng ĐẠT chuẩn (Pass):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={receivedGoodQty}
                    onChange={(e) => setReceivedGoodQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[var(--ink-secondary)] font-medium mb-1">
                    Số lượng HỎNG (Scrap):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receivedScrapQty}
                    onChange={(e) => setReceivedScrapQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-rose-700 dark:text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Nhân viên QC tiếp nhận:</label>
                <input
                  type="text"
                  required
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Ghi chú kiểm tra chất lượng:</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Kiểm tra 100 sản phẩm ngẫu nhiên, màu in đồng đều..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded bg-purple-600 px-4 py-1.5 font-medium text-white hover:bg-purple-700 shadow-xs"
                >
                  Xác nhận nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
