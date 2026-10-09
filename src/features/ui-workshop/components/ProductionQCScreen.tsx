"use client";

import { useState } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  RotateCcw, 
  FileText,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { WorkshopLSX } from "../types";
import { workshopRepo } from "../mock-repo";

interface Props {
  initialOrder?: WorkshopLSX;
  onRefresh: () => void;
  onNavigateToCompleted?: () => void;
}

export function ProductionQCScreen({ initialOrder, onRefresh, onNavigateToCompleted }: Props) {
  const qcOrders = workshopRepo.getOrders({ status: "QC" });
  const [selectedId, setSelectedId] = useState<string>(initialOrder?.id || qcOrders[0]?.id || "");
  const [passQty, setPassQty] = useState<number>(20);
  const [failQty, setFailQty] = useState<number>(0);
  const [failReason, setFailReason] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const order = workshopRepo.getOrderById(selectedId) || qcOrders[0];

  const handleRecordQcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (failQty > 0 && !failReason.trim()) {
      alert("Vui lòng nhập lý do lỗi QC của các sản phẩm không đạt");
      return;
    }

    const updated = workshopRepo.recordQcInspection(order.id, Number(passQty), Number(failQty), failReason);
    if (updated.status === "Completed") {
      setResultMessage(`Kiểm định thành công! Lệnh ${updated.code} đã đạt định mức và chuyển sang trạng thái HOÀN THÀNH (Completed).`);
    } else {
      setResultMessage(`Số lượng đạt (${passQty}) chưa đủ định mức kế hoạch (${updated.plannedQuantity}). Đã kích hoạt VÒNG IN BÙ (Reprint Round ${updated.reprintRound}) — Lệnh chuyển về Ready.`);
    }

    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-[var(--ink-primary)] flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          <span>Kiểm Tra Chất Lượng Sản Xuất (Production QC — SCRUM-419)</span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          QC Staff đối chiếu thành phẩm in thực tế trực tiếp với bản mẫu đã được khách duyệt (BR-PRD-05). Đủ chuẩn chuyển Completed; thiếu kích hoạt vòng in bù.
        </p>
      </div>

      {/* Select LSX */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1">
          Chọn Lệnh sản xuất đang ở trạm QC:
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setResultMessage(null);
          }}
          className="w-full md:w-1/2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-mono font-medium"
        >
          {qcOrders.length === 0 ? (
            <option value="">Không có LSX nào đang ở trạm QC</option>
          ) : (
            qcOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.customerName} ({o.blankSku})
              </option>
            ))
          )}
        </select>
      </div>

      {order ? (
        <div className="space-y-6">
          {/* Side-by-side Visual Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Approved Reference Sample (BR-PRD-05) */}
            <div className="rounded-lg border-2 border-emerald-500/40 bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>TIÊU CHUẨN: MẪU ĐÃ ĐƯỢC KHÁCH DUYỆT (LOCKED DESIGN)</span>
                </div>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  REF SAMPLE
                </span>
              </div>

              <div className="aspect-4/3 w-full rounded-md border border-[var(--border-default)] overflow-hidden bg-slate-900 relative">
                <img
                  src={order.qcReferenceSampleUrl}
                  alt="Mẫu duyệt"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="rounded bg-[var(--bg-subtle)] p-3 text-xs space-y-1">
                <div className="font-semibold text-[var(--ink-primary)]">Quy chuẩn kiểm định:</div>
                <p className="text-[11px] text-[var(--ink-secondary)]">
                  Đối chiếu tông màu mực in, độ sắc nét đường nét bo viền, căn chỉnh mép đáy ly, và độ dính mực bám dính trên phôi <strong>{order.blankSku}</strong>.
                </p>
              </div>
            </div>

            {/* Right: Actual Printed Item from Workshop */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-bold text-xs">
                  <Layers className="h-4 w-4" />
                  <span>THÀNH PHẨM IN THỰC TẾ TRÊN DÂY CHUYỀN</span>
                </div>
                <span className="rounded bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800 dark:text-purple-300">
                  ACTUAL OUTPUT
                </span>
              </div>

              <div className="aspect-4/3 w-full rounded-md border border-[var(--border-default)] overflow-hidden bg-slate-900 relative">
                <img
                  src={order.qcPrintFileUrl}
                  alt="Thành phẩm in"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="rounded bg-[var(--bg-subtle)] p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Kế hoạch cần:</span>
                  <span className="font-mono font-bold">{order.plannedQuantity.toLocaleString()} cái</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Máy in thực hiện:</span>
                  <span className="font-mono font-semibold">{order.machineId || "Flexo UV"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* QC Inspection Input Form */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--ink-primary)] mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <span>Ghi nhận kết quả kiểm tra chất lượng (QC Result Entry)</span>
            </h3>

            <form onSubmit={handleRecordQcSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--ink-primary)] font-semibold mb-1">
                    Số lượng ĐẠT (Pass):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={passQty}
                    onChange={(e) => setPassQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                  />
                  <span className="text-[11px] text-[var(--ink-tertiary)] mt-1 block">
                    Đủ {order.plannedQuantity} cái sẽ chuyển sang trạng thái Hoàn thành.
                  </span>
                </div>

                <div>
                  <label className="block text-[var(--ink-primary)] font-semibold mb-1">
                    Số lượng HỎNG / PHẾ (Fail):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={failQty}
                    onChange={(e) => setFailQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-rose-700 dark:text-rose-400"
                  />
                </div>
              </div>

              {failQty > 0 && (
                <div>
                  <label className="block text-[var(--ink-primary)] font-semibold mb-1">
                    Lý do không đạt QC (* bắt buộc ghi nhận phế phẩm):
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ví dụ: Lệch màu so với mẫu duyệt, bong tróc mực lúc cào nhẹ..."
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    className="w-full rounded border border-rose-300 dark:border-rose-900 bg-[var(--bg-subtle)] p-2 text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
                <button
                  type="submit"
                  className="rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 shadow-xs"
                >
                  Xác nhận kết quả QC
                </button>
              </div>
            </form>

            {/* Success / Result alert */}
            {resultMessage && (
              <div className="mt-4 rounded-md bg-emerald-50 dark:bg-emerald-950/60 p-4 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{resultMessage}</span>
                </div>
                {onNavigateToCompleted && (
                  <button
                    onClick={onNavigateToCompleted}
                    className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800 shrink-0 flex items-center gap-1"
                  >
                    <span>Xem danh sách Bàn giao</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center text-xs text-[var(--ink-tertiary)]">
          Hiện tại không có lệnh sản xuất nào ở trạm QC.
        </div>
      )}
    </div>
  );
}
