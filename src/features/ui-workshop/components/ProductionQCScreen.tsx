"use client";

import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, CheckCircle2, Layers, ArrowRight, AlertCircle } from "lucide-react";
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
  const [qcError, setQcError] = useState<string | null>(null);

  const order = workshopRepo.getOrderById(selectedId) || qcOrders[0];

  const handleRecordQcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (failQty > 0 && !failReason.trim()) {
      setQcError(
        "Vui lòng nhập lý do lỗi QC của các sản phẩm không đạt để ghi nhận phế phẩm & căn nguyên lỗi!",
      );
      return;
    }
    setQcError(null);

    const updated = workshopRepo.recordQcInspection(
      order.id,
      Number(passQty),
      Number(failQty),
      failReason,
    );
    if (updated.status === "Completed") {
      setResultMessage(
        `Kiểm định thành công! Lệnh ${updated.code} đã đạt định mức và chuyển sang trạng thái HOÀN THÀNH (Completed).`,
      );
    } else {
      setResultMessage(
        `Số lượng đạt (${passQty}) chưa đủ định mức kế hoạch (${updated.plannedQuantity}). Đã kích hoạt VÒNG IN BÙ (Reprint Round ${updated.reprintRound}) — Lệnh chuyển về Ready.`,
      );
    }

    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          <span>Kiểm Tra Chất Lượng Sản Xuất (Production QC — SCRUM-419)</span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          QC Staff đối chiếu thành phẩm in thực tế trực tiếp với bản mẫu đã được khách duyệt
          (BR-PRD-05). Đủ chuẩn chuyển Completed; thiếu kích hoạt vòng in bù.
        </p>
      </div>

      {/* Select LSX */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <label className="mb-1 block text-xs font-semibold text-[var(--ink-secondary)]">
          Chọn Lệnh sản xuất đang ở trạm QC:
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setResultMessage(null);
          }}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 font-mono text-xs font-medium md:w-1/2"
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left: Approved Reference Sample (BR-PRD-05) */}
            <div className="space-y-3 rounded-lg border-2 border-emerald-500/40 bg-[var(--bg-surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>TIÊU CHUẨN: MẪU ĐÃ ĐƯỢC KHÁCH DUYỆT (LOCKED DESIGN)</span>
                </div>
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  REF SAMPLE
                </span>
              </div>

              <div className="relative aspect-4/3 w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-slate-900">
                <Image
                  src={order.qcReferenceSampleUrl}
                  alt="Mẫu duyệt"
                  width={600}
                  height={450}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-1 rounded bg-[var(--bg-subtle)] p-3 text-xs">
                <div className="font-semibold text-[var(--ink-primary)]">Quy chuẩn kiểm định:</div>
                <p className="text-[11px] text-[var(--ink-secondary)]">
                  Đối chiếu tông màu mực in, độ sắc nét đường nét bo viền, căn chỉnh mép đáy ly, và
                  độ dính mực bám dính trên phôi <strong>{order.blankSku}</strong>.
                </p>
              </div>
            </div>

            {/* Right: Actual Printed Item from Workshop */}
            <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                  <Layers className="h-4 w-4" />
                  <span>THÀNH PHẨM IN THỰC TẾ TRÊN DÂY CHUYỀN</span>
                </div>
                <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  ACTUAL OUTPUT
                </span>
              </div>

              <div className="relative aspect-4/3 w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-slate-900">
                <Image
                  src={order.qcPrintFileUrl}
                  alt="Thành phẩm in"
                  width={600}
                  height={450}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-1 rounded bg-[var(--bg-subtle)] p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Kế hoạch cần:</span>
                  <span className="font-mono font-bold">
                    {order.plannedQuantity.toLocaleString()} cái
                  </span>
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
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <span>Ghi nhận kết quả kiểm tra chất lượng (QC Result Entry)</span>
            </h3>

            <form onSubmit={handleRecordQcSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
                    Số lượng ĐẠT (Pass):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={passQty}
                    onChange={(e) => setPassQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400"
                  />
                  <span className="mt-1 block text-[11px] text-[var(--ink-tertiary)]">
                    Đủ {order.plannedQuantity} cái sẽ chuyển sang trạng thái Hoàn thành.
                  </span>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
                    Số lượng HỎNG / PHẾ (Fail):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={failQty}
                    onChange={(e) => setFailQty(Number(e.target.value))}
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs font-bold text-rose-700 dark:text-rose-400"
                  />
                </div>
              </div>

              {failQty > 0 && (
                <div>
                  <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
                    Lý do không đạt QC (* bắt buộc ghi nhận phế phẩm):
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ví dụ: Lệch màu so với mẫu duyệt, bong tróc mực lúc cào nhẹ..."
                    value={failReason}
                    onChange={(e) => {
                      setFailReason(e.target.value);
                      if (qcError) setQcError(null);
                    }}
                    className="w-full rounded border border-rose-300 bg-[var(--bg-subtle)] p-2 text-xs dark:border-rose-900"
                  />
                </div>
              )}

              {qcError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{qcError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-3">
                <button
                  type="submit"
                  className="rounded-md bg-purple-600 px-4 py-2 font-medium text-white shadow-xs hover:bg-purple-700"
                >
                  Xác nhận kết quả QC
                </button>
              </div>
            </form>

            {/* Success / Result alert */}
            {resultMessage && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{resultMessage}</span>
                </div>
                {onNavigateToCompleted && (
                  <button
                    onClick={onNavigateToCompleted}
                    className="flex shrink-0 items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800"
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
