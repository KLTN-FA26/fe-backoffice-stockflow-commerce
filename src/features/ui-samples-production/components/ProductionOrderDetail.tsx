"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Printer,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/shared";
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
  const [modalError, setModalError] = useState<string | null>(null);

  const order = samplesProductionRepo.getProductionOrderById(orderId);

  if (!order) {
    return (
      <div className="p-8 text-center text-xs">
        <p>Không tìm thấy lệnh sản xuất.</p>
        <button onClick={onBack} className="mt-2 text-sky-600 underline">
          Quay lại
        </button>
      </div>
    );
  }

  const handlePrepressPass = () => {
    setModalError(null);
    samplesProductionRepo.prepressCheck(
      order.id,
      true,
      prepressNotes || "Kiểm tra checksum & tách màu khớp 100% với mẫu đã duyệt",
    );
    setShowPrepressModal(false);
    onRefresh();
  };

  const handlePrepressFail = () => {
    if (!prepressNotes.trim()) {
      setModalError(
        "Vui lòng ghi rõ lý do không đạt prepress để thông báo cho bộ phận Thiết kế & Sales!",
      );
      return;
    }
    setModalError(null);
    samplesProductionRepo.prepressCheck(order.id, false, prepressNotes);
    setShowPrepressModal(false);
    onRefresh();
  };

  const handleHold = () => {
    if (!holdReason.trim()) {
      setModalError("Vui lòng nhập lý do tạm dừng lệnh sản xuất!");
      return;
    }
    setModalError(null);
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
      setModalError("Vui lòng nhập lý do hủy lệnh sản xuất!");
      return;
    }
    setModalError(null);
    samplesProductionRepo.cancelProductionOrder(order.id, cancelReason);
    setShowCancelModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--ink-secondary)] shadow-xs hover:text-[var(--ink-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-[var(--ink-primary)]">
                {order.code}
              </h1>
              <StatusBadge status={order.type === "SAMPLE" ? "MẪU THỬ" : "ĐƠN HÀNG"} />
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Khách hàng: <strong>{order.customerName}</strong> · Hạn giao:{" "}
              <strong>{order.dueDate}</strong>
            </p>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {order.status === "Pending Prepress" && (
            <button
              onClick={() => setShowPrepressModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Kiểm tra Prepress</span>
            </button>
          )}

          {order.status === "On Hold" ? (
            <button
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-sky-700"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Tiếp tục lệnh (Resume)</span>
            </button>
          ) : (
            order.status !== "Completed" &&
            order.status !== "Cancelled" && (
              <button
                onClick={() => setShowHoldModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-xs hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <PauseCircle className="h-4 w-4" />
                <span>Tạm dừng (Hold)</span>
              </button>
            )
          )}

          {order.status !== "Completed" && order.status !== "Cancelled" && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 shadow-xs hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Ban className="h-4 w-4" />
              <span>Hủy LSX</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {order.status === "On Hold" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <strong className="text-sm">Lệnh sản xuất đang bị Tạm Dừng (On Hold):</strong>
              <p className="mt-1 font-medium">{order.holdReason}</p>
              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                Toàn bộ thao tác xuất phôi và in ấn đang bị tạm ngưng cho đến khi Quản đốc xưởng
                hoặc Kỹ thuật viên Prepress xử lý xong sự cố và bấm &ldquo;Tiếp tục lệnh&rdquo;.
              </p>
            </div>
          </div>
        </div>
      )}

      {order.status === "Cancelled" && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-2.5">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <strong className="text-sm">Lệnh sản xuất đã bị HỦY (Cancelled):</strong>
              <p className="mt-1">
                Lý do hủy: <strong>{order.cancellationReason}</strong>
              </p>
              <div className="mt-2 rounded border border-rose-200 bg-white/60 p-2 font-mono text-[11px] dark:bg-black/30">
                Kết quả chính sách (BR-PRD-10): {order.cancellationPolicyOutcome}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Prepress Check & Production Specs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Prepress Check Card (SCRUM-408) */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
              <span>Kiểm tra File in Prepress (BR-PRD-02)</span>
            </h3>
            {order.prepressCheckResult === "PASS" ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Prepress ĐẠT</span>
              </span>
            ) : order.prepressCheckResult === "FAIL" ? (
              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <XCircle className="h-3.5 w-3.5" />
                <span>Prepress HỎNG</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" />
                <span>Chưa kiểm tra</span>
              </span>
            )}
          </div>

          <div className="group relative aspect-video w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-slate-900">
            <Image
              src={order.prepressArtifact.previewUrl}
              alt="File in preview"
              width={600}
              height={400}
              unoptimized
              className="h-full w-full object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <a
                href={order.prepressArtifact.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-md"
              >
                <span>Xem bản in độ phân giải cao</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Artifact metadata */}
          <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Tệp tin in ấn:</span>
              <span
                className="max-w-[200px] truncate font-mono font-medium text-[var(--ink-primary)]"
                title={order.prepressArtifact.fileName}
              >
                {order.prepressArtifact.fileName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Dung lượng:</span>
              <span className="font-mono">
                {order.prepressArtifact.fileSize} · {order.prepressArtifact.resolutionDpi} DPI
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Tách màu phân tách:</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {order.prepressArtifact.colorSeparation.join(", ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-secondary)]">Mã checksum locked:</span>
              <span
                className="max-w-[220px] truncate font-mono text-[11px] text-[var(--ink-primary)]"
                title={order.prepressArtifact.checksum}
              >
                {order.prepressArtifact.checksum}
              </span>
            </div>
          </div>

          {order.prepressNotes && (
            <div className="rounded-md bg-[var(--bg-muted)] p-2.5 text-xs text-[var(--ink-secondary)]">
              <strong className="text-[var(--ink-primary)]">Ghi chú kiểm tra: </strong>
              <span>{order.prepressNotes}</span>
            </div>
          )}
        </div>

        {/* Production Specs & Hold History */}
        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
              <Printer className="h-4 w-4 text-[var(--accent)]" />
              <span>Thông số tiến độ sản xuất</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5">
                <span className="block text-[11px] text-[var(--ink-secondary)]">SL Kế hoạch</span>
                <span className="font-mono text-base font-bold text-[var(--ink-primary)]">
                  {order.plannedQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5">
                <span className="block text-[11px] text-[var(--ink-secondary)]">
                  SL Đã xuất phôi
                </span>
                <span className="font-mono text-base font-bold text-sky-600 dark:text-sky-400">
                  {order.issuedQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5">
                <span className="block text-[11px] text-[var(--ink-secondary)]">
                  SL In đạt (Good)
                </span>
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {order.goodQuantity.toLocaleString()}
                </span>
              </div>
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5">
                <span className="block text-[11px] text-[var(--ink-secondary)]">
                  SL Phôi phế (Scrap)
                </span>
                <span className="font-mono text-base font-bold text-rose-600 dark:text-rose-400">
                  {order.scrapQuantity.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-[var(--border-default)] pt-2 text-xs">
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
          <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
              <Clock className="h-4 w-4 text-[var(--ink-tertiary)]" />
              <span>Nhật ký Tạm dừng & Sự cố (Exception Log)</span>
            </h3>

            {order.holdHistory.length === 0 ? (
              <p className="text-xs text-[var(--ink-tertiary)] italic">
                Chưa có ghi nhận tạm dừng nào.
              </p>
            ) : (
              <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1 text-xs">
                {order.holdHistory.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold ${h.type === "HOLD" ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400"}`}
                      >
                        {h.type === "HOLD" ? "TẠM DỪNG (HOLD)" : "TIẾP TỤC (RESUME)"}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                        {h.timestamp}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                      Thực hiện: {h.actor}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--ink-primary)] italic">
                      &ldquo;{h.reason}&rdquo;
                    </p>
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Kiểm định File in Prepress (BR-PRD-02)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Kỹ thuật viên đối chiếu checksum SHA256 của file in với bản thiết kế mẫu đã duyệt. Nếu
              đạt, lệnh sẽ chuyển sang trạng thái <strong>Ready</strong>. Nếu không đạt, lệnh sẽ
              chuyển sang <strong>On Hold</strong>.
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--ink-primary)]">
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

            {modalError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowPrepressModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Đóng
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handlePrepressFail}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-rose-700"
                >
                  Không đạt (Chuyển Hold)
                </button>
                <button
                  onClick={handlePrepressPass}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
              <PauseCircle className="h-5 w-5" />
              <span>Tạm dừng Lệnh sản xuất (On Hold)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Vui lòng nêu rõ lý do tạm dừng (ví dụ: máy in hỏng, thiếu phôi trong kho, phát hiện
              lỗi file in, khách yêu cầu hoãn):
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--ink-primary)]">
                Lý do tạm dừng (* bắt buộc):
              </label>
              <textarea
                rows={3}
                placeholder="Nhập lý do cụ thể..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="w-full rounded-md border border-amber-300 bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)] dark:border-amber-800"
              />
            </div>

            {modalError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowHoldModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleHold}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-amber-700"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
              <Ban className="h-5 w-5" />
              <span>Hủy Lệnh sản xuất & Áp dụng chính sách (BR-PRD-10)</span>
            </h3>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>Quy tắc chính sách hủy:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>
                  Nếu hủy trước khi in: Phôi đã xuất sẽ hoàn nhập kho 100%, không phát sinh phí in.
                </li>
                <li>
                  Nếu hủy khi đang in: Tính toàn bộ chi phí dở dang và phế phẩm vào trách nhiệm đơn
                  hàng.
                </li>
              </ul>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--ink-primary)]">
                Lý do hủy lệnh (* bắt buộc):
              </label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Khách hủy đơn hàng, phát hiện phôi kém chất lượng..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-rose-300 bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)] dark:border-rose-900"
              />
            </div>

            {modalError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Bỏ qua
              </button>
              <button
                onClick={handleCancel}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-rose-700"
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
