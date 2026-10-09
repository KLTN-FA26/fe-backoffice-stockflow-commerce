"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  FileCheck, 
  MessageSquare,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { SampleRequest } from "../types";
import { samplesProductionRepo } from "../mock-repo";

interface Props {
  sampleId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function CustomerSamplePortalView({ sampleId, onBack, onRefresh }: Props) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);

  const sample = samplesProductionRepo.getSampleRequestById(sampleId);

  if (!sample) {
    return (
      <div className="p-8 text-center text-xs">
        <p>Không tìm thấy mẫu.</p>
        <button onClick={onBack} className="mt-2 text-sky-600 underline">Quay lại</button>
      </div>
    );
  }

  const handleApprove = () => {
    samplesProductionRepo.customerApprove(sample.id, approvalComment);
    setShowApproveModal(false);
    onRefresh();
  };

  const handleRequestChanges = () => {
    if (!feedback.trim()) {
      alert("Vui lòng ghi rõ nội dung cần điều chỉnh hoặc lý do không đạt");
      return;
    }
    samplesProductionRepo.customerRequestChanges(sample.id, feedback);
    setShowRejectModal(false);
    onRefresh();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Customer Portal Top Nav Simulation */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded border border-[var(--border-default)] p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Customer Portal · Phê duyệt mẫu thử
            </div>
            <h1 className="text-base font-bold text-[var(--ink-primary)]">
              {sample.designName}
            </h1>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-[var(--ink-tertiary)]">Khách hàng:</div>
          <div className="text-xs font-medium text-[var(--ink-primary)]">{sample.customerName}</div>
        </div>
      </div>

      {/* Main Review Card */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-md overflow-hidden">
        {/* Banner Status */}
        {sample.status === "Approved" ? (
          <div className="bg-emerald-600 text-white p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <div className="font-bold text-sm">BẠN ĐÃ PHÊ DUYỆT MẪU NÀY</div>
              <div className="text-xs text-emerald-100">
                Thiết kế đã được khoá kỹ thuật và sẵn sàng đưa vào sản xuất đơn hàng hàng loạt.
              </div>
            </div>
          </div>
        ) : sample.status === "Changes Requested" ? (
          <div className="bg-rose-600 text-white p-4 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <div className="font-bold text-sm">BẠN ĐÃ YÊU CẦU ĐIỀU CHỈNH MẪU (VÒNG {sample.roundNumber})</div>
              <div className="text-xs text-rose-100">
                Đội ngũ thiết kế & xưởng in StockFlow đang cập nhật lại bản mẫu theo phản hồi của bạn.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-amber-400" />
              <div>
                <div className="font-bold text-sm">YÊU CẦU PHÊ DUYỆT MẪU IN THỬ NGHIỆM</div>
                <div className="text-xs text-slate-300">
                  Vui lòng kiểm tra kỹ màu sắc, kích thước, phôi thực tế và xác nhận trước khi in hàng loạt.
                </div>
              </div>
            </div>
            <div className="rounded bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-amber-400">
              Vòng duyệt {sample.roundNumber}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-xs font-semibold text-[var(--ink-secondary)] mb-2 flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>BẢN CHỤP MẪU THỬ THỰC TẾ:</span>
            </div>
            <div className="aspect-square w-full rounded-lg border border-[var(--border-default)] overflow-hidden bg-slate-100">
              <img
                src={sample.designSnapshotUrl}
                alt={sample.designName}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 text-[11px] text-center text-[var(--ink-tertiary)] italic">
              Hình ảnh chụp trực tiếp từ xưởng StockFlow sau khi in và QC
            </p>
          </div>

          <div className="space-y-5 flex flex-col justify-between">
            <div className="space-y-3 text-xs">
              <div className="border-b border-[var(--border-default)] pb-2">
                <span className="text-[var(--ink-tertiary)] block text-[10px] uppercase">Mã phiếu mẫu</span>
                <span className="font-mono font-bold text-sm text-[var(--ink-primary)]">{sample.code}</span>
              </div>

              <div className="border-b border-[var(--border-default)] pb-2">
                <span className="text-[var(--ink-tertiary)] block text-[10px] uppercase">Quy cách phôi</span>
                <span className="font-medium text-[var(--ink-primary)]">{sample.blankName}</span>
                <span className="block font-mono text-[11px] text-[var(--ink-tertiary)]">SKU: {sample.blankSku}</span>
              </div>

              <div className="border-b border-[var(--border-default)] pb-2">
                <span className="text-[var(--ink-tertiary)] block text-[10px] uppercase">Công nghệ in</span>
                <span className="font-medium text-[var(--ink-primary)]">{sample.printSpec.technology}</span>
              </div>

              <div className="border-b border-[var(--border-default)] pb-2">
                <span className="text-[var(--ink-tertiary)] block text-[10px] uppercase">Bảng màu in</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sample.printSpec.colors.map((c, i) => (
                    <span key={i} className="rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-0.5 font-mono text-[11px]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[var(--ink-tertiary)] block text-[10px] uppercase">Kích thước vùng in</span>
                <span className="font-medium text-[var(--ink-primary)]">{sample.printSpec.dimensions}</span>
              </div>
            </div>

            {/* Customer Action Buttons */}
            {sample.status !== "Approved" && (
              <div className="pt-4 border-t border-[var(--border-default)] space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 py-2.5 px-4 text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Đồng ý & Phê duyệt mẫu</span>
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 py-2.5 px-4 text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Yêu cầu sửa mẫu</span>
                  </button>
                </div>
                <p className="text-[11px] text-center text-[var(--ink-tertiary)]">
                  Lưu ý: Phê duyệt mẫu sẽ khoá vĩnh viễn quy cách in để chuẩn bị sản xuất đơn hàng.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Approve */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span>Xác nhận Phê duyệt Mẫu thiết kế</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Bạn xác nhận mẫu in thử nghiệm đáp ứng đầy đủ tiêu chuẩn chất lượng. Thiết kế sẽ được khoá (Lock Design) làm quy chuẩn sản xuất chính thức.
            </p>
            <div>
              <label className="block text-xs text-[var(--ink-secondary)] mb-1">Ghi chú phê duyệt (tùy chọn):</label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Mẫu in sắc nét, đồng ý duyệt tiến hành đơn hàng..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowApproveModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleApprove}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-xs"
              >
                Xác nhận duyệt mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reject / Request Changes */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              <span>Gửi yêu cầu chỉnh sửa mẫu (Vòng tiếp theo)</span>
            </h3>
            <p className="text-xs text-[var(--ink-secondary)]">
              Vui lòng mô tả cụ thể chi tiết chưa đạt yêu cầu (màu sắc, tỷ lệ logo, vết lem, hoặc chất liệu phôi) để xưởng in khắc phục ở vòng tiếp theo:
            </p>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-primary)] mb-1">
                Nội dung góp ý / Lý do không đạt (* bắt buộc):
              </label>
              <textarea
                rows={4}
                placeholder="Ví dụ: Màu logo bị nhạt so với bản phối cảnh, cần tăng độ đậm mực in thêm 15%..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full rounded-md border border-rose-300 dark:border-rose-900 bg-[var(--bg-subtle)] p-2 text-xs text-[var(--ink-primary)] focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleRequestChanges}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 shadow-xs"
              >
                Gửi phản hồi cho xưởng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
