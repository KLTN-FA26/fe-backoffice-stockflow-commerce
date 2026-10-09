"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  Send, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  FileText,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { SampleRequest, SampleStatus } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  sampleId: string;
  onBack: () => void;
  onOpenPortal: (sample: SampleRequest) => void;
  onRefresh: () => void;
}

export function SampleRequestDetail({ sampleId, onBack, onOpenPortal, onRefresh }: Props) {
  const [carrier, setCarrier] = useState("Viettel Post Express");
  const [trackingCode, setTrackingCode] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);

  const sample = samplesProductionRepo.getSampleRequestById(sampleId);

  if (!sample) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--ink-secondary)]">Không tìm thấy yêu cầu mẫu.</p>
        <button onClick={onBack} className="mt-4 text-xs text-[var(--accent)] hover:underline">Quay lại danh sách</button>
      </div>
    );
  }

  const steps: SampleStatus[] = [
    "Draft",
    "Submitted",
    "In Production",
    "Ready",
    "Sent to Customer",
    "Approved"
  ];

  const currentStepIndex = steps.indexOf(sample.status);

  const handleSubmit = () => {
    samplesProductionRepo.submitSampleRequest(sample.id);
    onRefresh();
  };

  const handleRecordSent = () => {
    if (!trackingCode.trim()) {
      alert("Vui lòng nhập mã vận đơn giao hàng");
      return;
    }
    samplesProductionRepo.recordSentToCustomer(sample.id, carrier, trackingCode);
    setShowSendModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
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
              <h1 className="text-xl font-bold text-[var(--ink-primary)] font-mono">{sample.code}</h1>
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono font-bold text-[var(--ink-secondary)]">
                Vòng {sample.roundNumber}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Khách hàng: <strong>{sample.customerName}</strong> ({sample.customerCode})
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {sample.status === "Draft" && (
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Gửi sản xuất mẫu thử</span>
            </button>
          )}

          {sample.status === "Ready" && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shadow-xs"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Ghi nhận gửi mẫu cho khách</span>
            </button>
          )}

          <button
            onClick={() => onOpenPortal(sample)}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 dark:bg-sky-950/60 dark:border-sky-800 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 shadow-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở Customer Portal duyệt</span>
          </button>
        </div>
      </div>

      {/* Odoo-style Status bar */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[600px] text-xs">
          {steps.map((st, idx) => {
            const isDone = currentStepIndex > idx || sample.status === "Approved";
            const isCurrent = sample.status === st;
            return (
              <div key={st} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-sky-600 text-white ring-4 ring-sky-100 dark:ring-sky-950"
                        : "bg-[var(--bg-muted)] text-[var(--ink-tertiary)]"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-center font-medium ${
                      isCurrent
                        ? "text-sky-600 dark:text-sky-400 font-bold"
                        : isDone
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-[var(--ink-tertiary)]"
                    }`}
                  >
                    {st === "Draft" ? "Bản nháp" :
                     st === "Submitted" ? "Chờ duyệt SX" :
                     st === "In Production" ? "Đang in mẫu" :
                     st === "Ready" ? "Mẫu hoàn thành" :
                     st === "Sent to Customer" ? "Đã gửi khách" :
                     "Khách đã duyệt"}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      isDone ? "bg-emerald-500" : "bg-[var(--border-default)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback banner if changes requested */}
      {sample.status === "Changes Requested" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Khách hàng yêu cầu chỉnh sửa mẫu (Vòng {sample.roundNumber - 1}):</span>
              <p className="mt-1 text-rose-700 dark:text-rose-300">{sample.customerFeedback}</p>
            </div>
          </div>
        </div>
      )}

      {/* Approval banner */}
      {sample.status === "Approved" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm">Thiết kế đã được phê duyệt và khoá (Design Locked - BR-PRD-08):</span>
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                Bản mẫu và phôi SKU ({sample.blankSku}) đã được công nhận là tiêu chuẩn đối chiếu QC cho tất cả các lệnh sản xuất sau này của đơn hàng.
              </p>
              <div className="mt-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-200">
                Phê duyệt lúc: {sample.approvedAt} · Mã checksum kiểm định: {sample.printSpec.checksum}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two columns: Design & Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Design Snapshot */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--ink-tertiary)]" />
            <span>Phối cảnh thiết kế & Mẫu thử</span>
          </h3>

          <div className="aspect-4/3 w-full overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] relative">
            <img
              src={sample.designSnapshotUrl}
              alt={sample.designName}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
              <span className="text-[var(--ink-secondary)]">Tên bản in:</span>
              <span className="font-medium text-[var(--ink-primary)]">{sample.designName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
              <span className="text-[var(--ink-secondary)]">Công nghệ in:</span>
              <span className="font-medium text-[var(--ink-primary)]">{sample.printSpec.technology}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
              <span className="text-[var(--ink-secondary)]">Hệ màu / Spot:</span>
              <span className="font-mono text-[var(--ink-primary)]">{sample.printSpec.colors.join(", ")}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
              <span className="text-[var(--ink-secondary)]">Kích thước in:</span>
              <span className="font-medium text-[var(--ink-primary)]">{sample.printSpec.dimensions}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--ink-secondary)]">Mã kiểm tra Checksum:</span>
              <span className="font-mono text-[11px] text-[var(--ink-primary)]">{sample.printSpec.checksum}</span>
            </div>
          </div>
        </div>

        {/* Right column: Spec & Shipping Info */}
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--ink-tertiary)]" />
              <span>Thông số yêu cầu mẫu</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)]">Mã phôi SKU:</span>
                <span className="font-mono font-medium text-[var(--ink-primary)]">{sample.blankSku}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)]">Tên loại phôi:</span>
                <span className="font-medium text-[var(--ink-primary)]">{sample.blankName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)]">Số lượng mẫu thử:</span>
                <span className="font-mono font-bold text-[var(--ink-primary)]">{sample.sampleQuantity} cái</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-default)]">
                <span className="text-[var(--ink-secondary)]">Hạn giao mẫu:</span>
                <span className="font-medium text-[var(--ink-primary)]">{sample.dueDate}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--ink-secondary)]">Báo giá liên kết:</span>
                <span className="font-mono text-sky-600 dark:text-sky-400">{sample.linkedQuoteCode || "Không liên kết"}</span>
              </div>
            </div>

            {sample.trackingCode && (
              <div className="mt-4 rounded-md bg-[var(--bg-subtle)] p-3 border border-[var(--border-default)] text-xs">
                <div className="font-semibold text-[var(--ink-primary)] flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-[var(--accent)]" />
                  <span>Thông tin vận chuyển mẫu:</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[var(--ink-secondary)]">Đơn vị:</span>{" "}
                    <strong>{sample.carrier}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--ink-secondary)]">Mã vận đơn:</span>{" "}
                    <strong className="font-mono">{sample.trackingCode}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Timeline */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--ink-tertiary)]" />
              <span>Nhật ký duyệt mẫu (Activity Log)</span>
            </h3>

            <div className="space-y-3 text-xs max-h-60 overflow-y-auto pr-1">
              {sample.history.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 pb-2 border-b border-[var(--border-default)] last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--ink-primary)]">{h.status} (Vòng {h.round})</span>
                      <span className="text-[10px] text-[var(--ink-tertiary)] font-mono">{h.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)]">Người thực hiện: {h.actor}</div>
                    {h.comment && (
                      <div className="mt-1 rounded bg-[var(--bg-subtle)] p-1.5 text-[11px] italic text-[var(--ink-secondary)]">
                        "{h.comment}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Record Sent to Customer */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
              <Truck className="h-4 w-4 text-[var(--accent)]" />
              <span>Ghi nhận gửi mẫu cho khách hàng</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Mẫu in đã hoàn thành kiểm tra chất lượng tại xưởng. Vui lòng ghi nhận thông tin gửi mẫu ngoài hệ thống (bưu tá / chuyển phát).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--ink-secondary)] mb-1">Đơn vị vận chuyển:</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--ink-primary)]"
                />
              </div>
              <div>
                <label className="block text-[var(--ink-secondary)] mb-1">Mã vận đơn (Tracking number):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: VTP-992144882VN"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--ink-primary)] font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowSendModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleRecordSent}
                className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs"
              >
                Lưu xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
