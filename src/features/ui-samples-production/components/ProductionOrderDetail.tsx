"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  PauseCircle, 
  PlayCircle, 
  Ban, 
  ShieldCheck, 
  AlertTriangle,
  Clock,
  Printer,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { ProductionOrder, ProductionOrderStatus } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  orderId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function ProductionOrderDetail({ orderId, onBack, onRefresh }: Props) {
  const [showPrepressModal, setShowPrepressModal] = useState(false);
  const [prepressNotes, setPrepressNotes] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const order = samplesProductionRepo.getProductionOrderById(orderId);

  if (!order) {
    return (
      <div className="p-8 text-center text-xs">
        <p>Không tìm thấy lệnh sản xuất.</p>
        <button onClick={onBack} className="mt-2 text-sky-600 underline">Quay lại</button>
      </div>
    );
  }

  const handlePrepressPass = () => {
    samplesProductionRepo.prepressCheck(order.id, true, prepressNotes || "Kiểm tra checksum & tách màu khớp 100% với mẫu đã duyệt");
    setShowPrepressModal(false);
    onRefresh();
  };

  const handlePrepressFail = () => {
    if (!prepressNotes.trim()) {
      alert("Vui lòng ghi rõ lý do không đạt prepress để thông báo cho bộ phận Thiết kế & Sales");
      return;
    }
    samplesProductionRepo.prepressCheck(order.id, false, prepressNotes);
    setShowPrepressModal(false);
    onRefresh();
  };

  const handleHold = () => {
    if (!holdReason.trim()) {
      alert("Vui lòng nhập lý do tạm dừng lệnh sản xuất");
      return;
    }
    samplesProductionRepo.holdProductionOrder(order.id, holdReason);
    setShowHoldModal(false);
    onRefresh();
  };

  const handleResume = () => {
    samplesProductionRepo.resumeProductionOrder(order.id);
    onRefresh();
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      alert("Vui lòng nhập lý do hủy lệnh sản xuất");
      return;
    }
    samplesProductionRepo.cancelProductionOrder(order.id, cancelReason);
    setShowCancelModal(false);
    onRefresh();
  };

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
              <h1 className="text-xl font-bold font-mono text-[var(--ink-primary)]">{order.code}</h1>
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                order.type === "SAMPLE" 
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" 
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              }`}>
                {order.type === "SAMPLE" ? "LSX MẪU THỬ" : "LSX ĐƠN HÀNG"}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Khách hàng: <strong>{order.customerName}</strong> · Hạn giao: <strong>{order.dueDate}</strong>
            </p>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {order.status === "Pending Prepress" && (
            <button
              onClick={() => setShowPrepressModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-xs"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Kiểm tra Prepress</span>
            </button>
          )}

          {order.status === "On Hold" ? (
            <button
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 shadow-xs"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Tiếp tục lệnh (Resume)</span>
            </button>
          ) : order.status !== "Completed" && order.status !== "Cancelled" && (
            <button
              onClick={() => setShowHoldModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 shadow-xs"
            >
              <PauseCircle className="h-4 w-4" />
              <span>Tạm dừng (Hold)</span>
            </button>
          )}

          {order.status !== "Completed" && order.status !== "Cancelled" && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-3 py-1.5 text-xs font-medium hover:bg-rose-100 shadow-xs"
            >
              <Ban className="h-4 w-4" />
              <span>Hủy LSX</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {order.status === "On Hold" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm">Lệnh sản xuất đang bị Tạm Dừng (On Hold):</strong>
              <p className="mt-1 font-medium">{order.holdReason}</p>
              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                Toàn bộ thao tác xuất phôi và in ấn đang bị tạm ngưng cho đến khi Quản đốc xưởng hoặc Kỹ thuật viên Prepress xử lý xong sự cố và bấm "Tiếp tục lệnh".
              </p>
            </div>
          </div>
        </div>
      )}

      {order.status === "Cancelled" && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-start gap-2.5">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sm">Lệnh sản xuất đã bị HỦY (Cancelled):</strong>
              <p className="mt-1">Lý do hủy: <strong>{order.cancellationReason}</strong></p>
              <div className="mt-2 rounded bg-white/60 dark:bg-black/30 p-2 font-mono text-[11px] border border-rose-200">
                Kết quả chính sách (BR-PRD-10): {order.cancellationPolicyOutcome}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Prepress Check & Production Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prepress Check Card (SCRUM-408) */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
              <span>Kiểm tra File in Prepress (BR-PRD-02)</span>
            </h3>
            {order.prepressCheckResult === "PASS" ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Prepress ĐẠT</span>
              </span>
            ) : order.prepressCheckResult === "FAIL" ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-xs font-bold">
                <XCircle className="h-3.5 w-3.5" />
                <span>Prepress HỎNG</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-xs font-bold">
                <Clock className="h-3.5 w-3.5" />
                <span>Chưa kiểm tra</span>
              </span>
            )}
          </div>

          <div className="aspect-video w-full rounded-md border border-[var(--border-default)] bg-slate-900 overflow-hidden relative group">
            <img
              src={order.prepressArtifact.previewUrl}
              alt="File in preview"
              className="h-full w-full object-contain"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <a
                href={order.prepressArtifact.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-md flex items-center gap-1"
              >
                <span>Xem bản in độ phân giải cao</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Artifact metadata */}
          <div className="rounded-md bg-[var(--bg-subtle)] p-3 border border-[var(--border-default)] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Tệp tin in ấn:</span>
              <span className="font-mono font-medium text-[var(--ink-primary)] truncate max-w-[200px]" title={order.prepressArtifact.fileName}>
                {order.prepressArtifact.fileName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Dung lượng:</span>
              <span className="font-mono">{order.prepressArtifact.fileSize} · {order.prepressArtifact.resolutionDpi} DPI</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Tách màu phân tách:</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {order.prepressArtifact.colorSeparation.join(", ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Mã checksum locked:</span>
              <span className="font-mono text-[11px] text-[var(--ink-primary)] truncate max-w-[220px]" title={order.prepressArtifact.checksum}>
                {order.prepressArtifact.checksum}
              </span>
            </div>
          </div>

          {order.prepressNotes && (
            <div className="text-xs text-[var(--ink-secondary)] bg-[var(--bg-muted)] p-2.5 rounded-md">
              <strong className="text-[var(--ink-primary)]">Ghi chú kiểm tra: </strong>
              <span>{order.prepressNotes}</span>
            </div>
          )}
        </div>

        {/* Production Specs & Hold History */}
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <Printer className="h-4 w-4 text-[var(--accent)]" />
              <span>Thông số tiến độ sản xuất</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-[var(--bg-subtle)] p-2.5 border border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)] block text-[11px]">SL Kế hoạch</span>
                <span className="text-base font-bold font-mono text-[var(--ink-primary)]">
                  {order.plannedQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md bg-[var(--bg-subtle)] p-2.5 border border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)] block text-[11px]">SL Đã xuất phôi</span>
                <span className="text-base font-bold font-mono text-sky-600 dark:text-sky-400">
                  {order.issuedQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md bg-[var(--bg-subtle)] p-2.5 border border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)] block text-[11px]">SL In đạt (Good)</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {order.goodQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md bg-[var(--bg-subtle)] p-2.5 border border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)] block text-[11px]">SL Phôi phế (Scrap)</span>
                <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                  {order.scrapQuantity.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border-default)] text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Mã phôi SKU:</span>
                <span className="font-mono font-medium">{order.blankSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Loại sản phẩm:</span>
                <span className="font-medium">{order.blankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-secondary)]">Thời gian tạo LSX:</span>
                <span className="font-mono text-[11px]">{order.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Hold & Status History */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--ink-tertiary)]" />
              <span>Nhật ký Tạm dừng & Sự cố (Exception Log)</span>
            </h3>

            {order.holdHistory.length === 0 ? (
              <p className="text-xs text-[var(--ink-tertiary)] italic">Chưa có ghi nhận tạm dừng nào.</p>
            ) : (
              <div className="space-y-2.5 max-h-48 overflow-y-auto text-xs pr-1">
                {order.holdHistory.map((h, i) => (
                  <div key={i} className="rounded-md bg-[var(--bg-subtle)] p-2.5 border border-[var(--border-default)]">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${h.type === "HOLD" ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400"}`}>
                        {h.type === "HOLD" ? "TẠM DỪNG (HOLD)" : "TIẾP TỤC (RESUME)"}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--ink-tertiary)]">{h.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)] mt-0.5">Thực hiện: {h.actor}</div>
                    <p className="mt-1 text-[11px] text-[var(--ink-primary)] italic">"{h.reason}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Prepress Check */}
      {showPrepressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Kiểm định File in Prepress (BR-PRD-02)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Kỹ thuật viên đối chiếu checksum SHA256 của file in với bản thiết kế mẫu đã duyệt. Nếu đạt, lệnh sẽ chuyển sang trạng thái <strong>Ready</strong>. Nếu không đạt, lệnh sẽ chuyển sang <strong>On Hold</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1">
                Ghi chú kiểm định / Lý do lỗi:
              </label>
              <textarea
                rows={3}
                placeholder="Nhập ghi chú kỹ thuật, căn chỉnh bleed, lệch màu nếu có..."
                value={prepressNotes}
                onChange={(e) => setPrepressNotes(e.target.value)}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)]"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowPrepressModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Đóng
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handlePrepressFail}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 shadow-xs"
                >
                  Không đạt (Chuyển Hold)
                </button>
                <button
                  onClick={handlePrepressPass}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-xs"
                >
                  Đạt (Chuyển Ready)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hold */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <PauseCircle className="h-5 w-5" />
              <span>Tạm dừng Lệnh sản xuất (On Hold)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Vui lòng nêu rõ lý do tạm dừng (ví dụ: máy in hỏng, thiếu phôi trong kho, phát hiện lỗi file in, khách yêu cầu hoãn):
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1">
                Lý do tạm dừng (* bắt buộc):
              </label>
              <textarea
                rows={3}
                placeholder="Nhập lý do cụ thể..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="w-full rounded-md border border-amber-300 dark:border-amber-800 bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowHoldModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleHold}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 shadow-xs"
              >
                Xác nhận Tạm dừng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancel (SCRUM-414) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              <span>Hủy Lệnh sản xuất & Áp dụng chính sách (BR-PRD-10)</span>
            </h3>
            
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 text-xs text-amber-800 dark:text-amber-200">
              <strong>Quy tắc chính sách hủy:</strong>
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>Nếu hủy trước khi in: Phôi đã xuất sẽ hoàn nhập kho 100%, không phát sinh phí in.</li>
                <li>Nếu hủy khi đang in: Tính toàn bộ chi phí dở dang và phế phẩm vào trách nhiệm đơn hàng.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1">
                Lý do hủy lệnh (* bắt buộc):
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Khách hủy đơn hàng, phát hiện phôi kém chất lượng..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-rose-300 dark:border-rose-900 bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleCancel}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 shadow-xs"
              >
                Xác nhận Hủy Lệnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
