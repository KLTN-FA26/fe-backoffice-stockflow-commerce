"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  RotateCcw, 
  Layers, 
  FileText,
  ShieldCheck,
  Calendar,
  CreditCard
} from "lucide-react";
import { B2BQuote } from "../types";
import { b2bRepo } from "../mock-repo";

interface Props {
  quote: B2BQuote;
  onBack: () => void;
  onRefresh: () => void;
}

export function CustomerQuotePortalView({ quote, onBack, onRefresh }: Props) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [comment, setComment] = useState("");
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleAcceptSubmit = () => {
    const res = b2bRepo.customerAcceptQuote(quote.id);
    if (res.success) {
      setActionAlert({ type: "success", message: res.message });
      onRefresh();
    } else {
      setActionAlert({ type: "error", message: res.message });
    }
  };

  const handleRejectSubmit = () => {
    if (!comment.trim()) {
      alert("Vui lòng nhập lý do hoặc đề xuất thay đổi báo giá");
      return;
    }
    b2bRepo.customerRequestQuoteChanges(quote.id, comment);
    setShowRejectModal(false);
    onRefresh();
  };

  const hasUnapprovedNew = quote.lines.some((l) => l.isNewDesign && !l.sampleApproved);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Simulator */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded border border-[var(--border-default)] p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Customer Portal · Xem & Phê duyệt Báo giá B2B
            </div>
            <h1 className="text-base font-bold text-[var(--ink-primary)]">
              Báo giá số: {quote.code} (v{quote.version})
            </h1>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-[var(--ink-tertiary)]">Khách hàng: </span>
          <span className="font-semibold text-[var(--ink-primary)]">{quote.customerName}</span>
        </div>
      </div>

      {/* Alert Result */}
      {actionAlert && (
        <div
          className={`rounded-lg p-4 text-xs border flex items-start gap-3 ${
            actionAlert.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300"
          }`}
        >
          {actionAlert.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">
              {actionAlert.type === "success" ? "XÁC NHẬN THÀNH CÔNG" : "KHÔNG THỂ PHÊ DUYỆT BÁO GIÁ"}
            </div>
            <p className="mt-1 leading-relaxed">{actionAlert.message}</p>
          </div>
        </div>
      )}

      {/* Quote Status Banner */}
      {quote.status === "ACCEPTED" ? (
        <div className="bg-emerald-600 text-white rounded-lg p-4 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-bold text-sm">BÁO GIÁ ĐÃ ĐƯỢC CHẤP THUẬN</div>
            <div className="text-xs text-emerald-100">
              Đơn hàng bán (Sales Order) đã được khởi tạo tự động. Xưởng in đang chuẩn bị kế hoạch sản xuất.
            </div>
          </div>
        </div>
      ) : quote.status === "CHANGES_REQUESTED" ? (
        <div className="bg-rose-600 text-white rounded-lg p-4 shadow-sm flex items-center gap-3">
          <RotateCcw className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-bold text-sm">ĐÃ GỬI YÊU CẦU ĐIỀU CHỈNH BÁO GIÁ</div>
            <div className="text-xs text-rose-100">
              Phản hồi: "{quote.customerComment}". Đội ngũ Sales sẽ cập nhật bản báo giá mới (v{quote.version + 1}).
            </div>
          </div>
        </div>
      ) : hasUnapprovedNew && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-amber-800 dark:text-amber-300">
              CẦN DUYỆT MẪU THỬ TRƯỚC KHI CHẤP THUẬN BÁO GIÁ (SAMPLE APPROVAL REQUIRED — BR-PRD-08)
            </div>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Báo giá này có chứa sản phẩm thiết kế mới chưa được phê duyệt mẫu in thử nghiệm. Theo quy định chất lượng StockFlow, mẫu thử phải được phê duyệt trước khi đơn hàng chính thức được giải phóng vào sản xuất.
            </p>
          </div>
        </div>
      )}

      {/* Quote Details Card */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-6">
        {/* Terms row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[var(--border-default)] text-xs">
          <div>
            <span className="text-[var(--ink-secondary)] block text-[11px]">Hạn hiệu lực báo giá:</span>
            <div className="font-mono font-bold text-[var(--ink-primary)] flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              <span>{quote.validUntil}</span>
            </div>
          </div>
          <div>
            <span className="text-[var(--ink-secondary)] block text-[11px]">Điều khoản công nợ & thanh toán:</span>
            <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1 mt-0.5">
              <CreditCard className="h-3.5 w-3.5" />
              <span>{quote.paymentTerm} (Thanh toán sau kỳ hạn thỏa thuận)</span>
            </div>
          </div>
          <div>
            <span className="text-[var(--ink-secondary)] block text-[11px]">Người đại diện liên hệ:</span>
            <div className="font-medium text-[var(--ink-primary)] mt-0.5">
              {quote.contactPerson} ({quote.customerEmail})
            </div>
          </div>
        </div>

        {/* Lines and Tier Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--accent)]" />
            <span>Chi tiết các dòng sản phẩm & Bậc giá theo số lượng (Tier Pricing)</span>
          </h3>

          {quote.lines.map((line) => (
            <div
              key={line.id}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 space-y-4 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded border border-[var(--border-default)] overflow-hidden bg-white shrink-0">
                    <img src={line.designSnapshotUrl} alt={line.designName} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--ink-primary)]">{line.designName}</div>
                    <div className="text-[11px] text-[var(--ink-secondary)]">
                      {line.blankName} (SKU: <span className="font-mono">{line.blankSku}</span>)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {line.isNewDesign ? (
                    line.sampleApproved ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mẫu thử đã duyệt</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-[11px] font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Thiết kế mới — Chưa duyệt mẫu</span>
                      </span>
                    )
                  ) : (
                    <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-semibold">
                      Thiết kế đã có mẫu sẵn
                    </span>
                  )}
                </div>
              </div>

              {/* Tiers Grid */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--ink-secondary)] block mb-1.5">
                  Bảng bậc giá áp dụng theo số lượng đặt hàng:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {line.tiers.map((t, idx) => {
                    const isSelectedTier =
                      line.selectedQuantity >= t.minQuantity &&
                      (!t.maxQuantity || line.selectedQuantity <= t.maxQuantity);
                    return (
                      <div
                        key={idx}
                        className={`rounded-md p-2.5 border text-xs transition-colors ${
                          isSelectedTier
                            ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500"
                            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        <div className="font-mono font-semibold">
                          {t.minQuantity.toLocaleString()} {t.maxQuantity ? `– ${t.maxQuantity.toLocaleString()}` : "+"} cái
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-mono font-bold text-sm text-[var(--ink-primary)]">
                            {t.unitPrice.toLocaleString()} đ
                          </span>
                          {t.discountPercent ? (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Giảm {t.discountPercent}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Line Total */}
              <div className="flex justify-between items-center pt-2 border-t border-[var(--border-default)]">
                <div>
                  <span className="text-[var(--ink-secondary)]">Số lượng đặt: </span>
                  <strong className="font-mono text-sm">{line.selectedQuantity.toLocaleString()} cái</strong>
                  <span className="text-[var(--ink-tertiary)] font-mono text-[11px] ml-2">
                    (@ {line.unitPrice.toLocaleString()} đ/cái)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[var(--ink-secondary)]">Thành tiền dòng: </span>
                  <strong className="font-mono text-sm text-amber-700 dark:text-amber-400">
                    {line.lineTotal.toLocaleString()} đ
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Calculation */}
        <div className="rounded-lg bg-[var(--bg-subtle)] p-4 border border-[var(--border-default)] text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--ink-secondary)]">Tổng cộng tiền hàng:</span>
            <span className="font-mono font-semibold">{quote.subtotal.toLocaleString()} đ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-secondary)]">Thuế VAT (10%):</span>
            <span className="font-mono font-semibold">{quote.taxAmount.toLocaleString()} đ</span>
          </div>
          <div className="flex justify-between border-t border-[var(--border-default)] pt-2 text-sm">
            <span className="font-bold text-[var(--ink-primary)]">TỔNG GIÁ TRỊ THANH TOÁN:</span>
            <span className="font-mono font-extrabold text-amber-700 dark:text-amber-400">
              {quote.grandTotal.toLocaleString()} VNĐ
            </span>
          </div>
        </div>

        {/* Actions for customer */}
        {quote.status !== "ACCEPTED" && quote.status !== "EXPIRED" && (
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAcceptSubmit}
              className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 shadow-md flex items-center justify-center gap-2 transition-colors text-xs"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Chấp thuận & Đặt hàng theo báo giá</span>
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex-1 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3 px-4 shadow-xs flex items-center justify-center gap-2 transition-colors text-xs"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Yêu cầu điều chỉnh giá / số lượng</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Reject / Request Changes */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-lg space-y-4 text-xs">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              <span>Yêu cầu điều chỉnh báo giá</span>
            </h3>
            <p className="text-[var(--ink-secondary)]">
              Vui lòng nhập đề xuất điều chỉnh đơn giá, số lượng hoặc thời hạn thanh toán mong muốn:
            </p>
            <textarea
              rows={3}
              required
              placeholder="Ví dụ: Mong muốn giảm giá thêm 5% cho đơn 20.000 cái..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded border border-rose-300 dark:border-rose-900 bg-[var(--bg-subtle)] p-2 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-default)]">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSubmit}
                className="rounded bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700 shadow-xs"
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
