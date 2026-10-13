"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  Calendar,
  CreditCard,
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
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
      setRevisionError(
        "Vui lòng nhập lý do hoặc đề xuất thay đổi báo giá để chuyên viên kinh doanh hỗ trợ!",
      );
      return;
    }
    setRevisionError(null);
    b2bRepo.customerRequestQuoteChanges(quote.id, comment);
    setShowRejectModal(false);
    onRefresh();
  };

  const hasUnapprovedNew = quote.lines.some((l) => l.isNewDesign && !l.sampleApproved);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Banner Simulator */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded border border-[var(--border-default)] p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-xs font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
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
          className={`flex items-start gap-3 rounded-lg border p-4 text-xs ${
            actionAlert.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {actionAlert.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          )}
          <div>
            <div className="text-sm font-bold">
              {actionAlert.type === "success"
                ? "XÁC NHẬN THÀNH CÔNG"
                : "KHÔNG THỂ PHÊ DUYỆT BÁO GIÁ"}
            </div>
            <p className="mt-1 leading-relaxed">{actionAlert.message}</p>
          </div>
        </div>
      )}

      {/* Quote Status Banner */}
      {quote.status === "ACCEPTED" ? (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-600 p-4 text-white shadow-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <div className="text-sm font-bold">BÁO GIÁ ĐÃ ĐƯỢC CHẤP THUẬN</div>
            <div className="text-xs text-emerald-100">
              Đơn hàng bán (Sales Order) đã được khởi tạo tự động. Xưởng in đang chuẩn bị kế hoạch
              sản xuất.
            </div>
          </div>
        </div>
      ) : quote.status === "CHANGES_REQUESTED" ? (
        <div className="flex items-center gap-3 rounded-lg bg-rose-600 p-4 text-white shadow-sm">
          <RotateCcw className="h-6 w-6 shrink-0" />
          <div>
            <div className="text-sm font-bold">ĐÃ GỬI YÊU CẦU ĐIỀU CHỈNH BÁO GIÁ</div>
            <div className="text-xs text-rose-100">
              Phản hồi: &ldquo;{quote.customerComment}&rdquo;. Đội ngũ Sales sẽ cập nhật bản báo giá
              mới (v{quote.version + 1}).
            </div>
          </div>
        </div>
      ) : (
        hasUnapprovedNew && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/15 p-4 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                CẦN DUYỆT MẪU THỬ TRƯỚC KHI CHẤP THUẬN BÁO GIÁ (SAMPLE APPROVAL REQUIRED —
                BR-PRD-08)
              </div>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Báo giá này có chứa sản phẩm thiết kế mới chưa được phê duyệt mẫu in thử nghiệm.
                Theo quy định chất lượng StockFlow, mẫu thử phải được phê duyệt trước khi đơn hàng
                chính thức được giải phóng vào sản xuất.
              </p>
            </div>
          </div>
        )
      )}

      {/* Quote Details Card */}
      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm">
        {/* Terms row */}
        <div className="grid grid-cols-1 gap-4 border-b border-[var(--border-default)] pb-4 text-xs sm:grid-cols-3">
          <div>
            <span className="block text-[11px] text-[var(--ink-secondary)]">
              Hạn hiệu lực báo giá:
            </span>
            <div className="mt-0.5 flex items-center gap-1 font-mono font-bold text-[var(--ink-primary)]">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              <span>{quote.validUntil}</span>
            </div>
          </div>
          <div>
            <span className="block text-[11px] text-[var(--ink-secondary)]">
              Điều khoản công nợ & thanh toán:
            </span>
            <div className="mt-0.5 flex items-center gap-1 font-bold text-sky-700 dark:text-sky-400">
              <CreditCard className="h-3.5 w-3.5" />
              <span>{quote.paymentTerm} (Thanh toán sau kỳ hạn thỏa thuận)</span>
            </div>
          </div>
          <div>
            <span className="block text-[11px] text-[var(--ink-secondary)]">
              Người đại diện liên hệ:
            </span>
            <div className="mt-0.5 font-medium text-[var(--ink-primary)]">
              {quote.contactPerson} ({quote.customerEmail})
            </div>
          </div>
        </div>

        {/* Lines and Tier Table */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
            <Layers className="h-4 w-4 text-[var(--accent)]" />
            <span>Chi tiết các dòng sản phẩm & Bậc giá theo số lượng (Tier Pricing)</span>
          </h3>

          {quote.lines.map((line) => (
            <div
              key={line.id}
              className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-xs"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-[var(--border-default)] bg-white">
                    <Image
                      src={line.designSnapshotUrl}
                      alt={line.designName}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--ink-primary)]">
                      {line.designName}
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)]">
                      {line.blankName} (SKU: <span className="font-mono">{line.blankSku}</span>)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {line.isNewDesign ? (
                    line.sampleApproved ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mẫu thử đã duyệt</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Thiết kế mới — Chưa duyệt mẫu</span>
                      </span>
                    )
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      Thiết kế đã có mẫu sẵn
                    </span>
                  )}
                </div>
              </div>

              {/* Tiers Grid */}
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold text-[var(--ink-secondary)]">
                  Bảng bậc giá áp dụng theo số lượng đặt hàng:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {line.tiers.map((t, idx) => {
                    const isSelectedTier =
                      line.selectedQuantity >= t.minQuantity &&
                      (!t.maxQuantity || line.selectedQuantity <= t.maxQuantity);
                    return (
                      <div
                        key={idx}
                        className={`rounded-md border p-2.5 text-xs transition-colors ${
                          isSelectedTier
                            ? "border-amber-500 bg-amber-50/60 text-amber-900 ring-1 ring-amber-500 dark:bg-amber-950/30 dark:text-amber-200"
                            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        <div className="font-mono font-semibold">
                          {t.minQuantity.toLocaleString()}{" "}
                          {t.maxQuantity ? `– ${t.maxQuantity.toLocaleString()}` : "+"} cái
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-mono text-sm font-bold text-[var(--ink-primary)]">
                            {t.unitPrice.toLocaleString()} đ
                          </span>
                          {t.discountPercent ? (
                            <span className="text-[10px] font-bold text-emerald-600">
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
              <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
                <div>
                  <span className="text-[var(--ink-secondary)]">Số lượng đặt: </span>
                  <strong className="font-mono text-sm">
                    {line.selectedQuantity.toLocaleString()} cái
                  </strong>
                  <span className="ml-2 font-mono text-[11px] text-[var(--ink-tertiary)]">
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
        <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-xs">
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
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              onClick={handleAcceptSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Chấp thuận & Đặt hàng theo báo giá</span>
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 shadow-xs transition-colors hover:bg-rose-100"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-xs shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
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
              onChange={(e) => {
                setComment(e.target.value);
                if (revisionError) setRevisionError(null);
              }}
              className="w-full rounded border border-rose-300 bg-[var(--bg-subtle)] p-2 text-xs dark:border-rose-900"
            />

            {revisionError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{revisionError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSubmit}
                className="rounded bg-rose-600 px-3 py-1.5 font-medium text-white shadow-xs hover:bg-rose-700"
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
