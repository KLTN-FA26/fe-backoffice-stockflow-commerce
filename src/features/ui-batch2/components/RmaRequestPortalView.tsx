"use client";

import { useState } from "react";
import Image from "next/image";
import { RotateCcw, CheckCircle2, Camera, FileCheck, Send, AlertCircle } from "lucide-react";
import { batch2Repo } from "../mock-repo";
import { RmaReason } from "../types";

export function RmaRequestPortalView() {
  const [orderCode, setOrderCode] = useState("SO-2026-0380");
  const [customerName, setCustomerName] = useState("Trà sữa Đô Đô Hà Nội");
  const [customerPhone, setCustomerPhone] = useState("0912 345 678");
  const [type, setType] = useState<"REFUND" | "EXCHANGE">("EXCHANGE");
  const [reason, setReason] = useState<RmaReason>("PRINT_DEFECT");
  const [returnQty, setReturnQty] = useState(500);
  const [reasonDetail, setReasonDetail] = useState(
    "Bị lem mực ở viền mép đáy ly và logo bị xô lệch 2mm so với mẫu đã ký.",
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>([
    "https://images.unsplash.com/photo-1558877085-7835154371bb?w=600&auto=format&fit=crop&q=80",
  ]);
  const [submittedRmaCode, setSubmittedRmaCode] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddSamplePhoto = () => {
    setPhotoUrls((prev) => [
      ...prev,
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80",
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonDetail.trim()) {
      setFormError(
        "Vui lòng mô tả chi tiết lý do và hiện trạng lỗi sản phẩm trước khi gửi yêu cầu.",
      );
      return;
    }
    setFormError(null);

    const created = batch2Repo.createRmaRequest(orderCode, customerName, customerPhone, type, [
      {
        orderLineId: "line-new",
        sku: "LY-NHUA-PP-500",
        productName: "Ly nhựa PP mờ sần 500ml",
        deliveredQty: 4000,
        returnQty: Number(returnQty),
        reason,
        reasonDetail,
        photoUrls,
      },
    ]);

    setSubmittedRmaCode(created.rmaCode);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
          <RotateCcw className="h-5 w-5 text-purple-600" />
          <span>
            Cổng Khách Hàng Gửi Yêu Cầu Đổi Trả RMA (Customer RMA Request Portal — SCRUM-257)
          </span>
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          Khách hàng khởi tạo phiếu bảo hành/đổi trả hàng lỗi in ấn hoặc hư hỏng sau khi nhận hàng
          từ StockFlow.
        </p>
      </div>

      {submittedRmaCode ? (
        <div className="space-y-4 rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-center shadow-xs dark:bg-emerald-950/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
              Gửi yêu cầu đổi trả thành công!
            </h3>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
              Mã yêu cầu RMA của bạn:{" "}
              <strong className="font-mono text-sm">{submittedRmaCode}</strong>
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-emerald-700 dark:text-emerald-300">
              Bộ phận CSKH và Giám sát Chất lượng (QC) của StockFlow sẽ thẩm định hồ sơ hình ảnh
              trong vòng 2 giờ làm việc và phản hồi phương án xử lý.
            </p>
          </div>
          <button
            onClick={() => {
              setSubmittedRmaCode(null);
              setReasonDetail("");
            }}
            className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
          >
            Tạo thêm yêu cầu mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                    Mã đơn hàng đã giao:
                  </label>
                  <input
                    type="text"
                    required
                    value={orderCode}
                    onChange={(e) => setOrderCode(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                    Số điện thoại liên hệ:
                  </label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Đại diện khách hàng / Doanh nghiệp:
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                />
              </div>

              {/* Resolution Choice */}
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <label className="mb-2 block font-semibold text-[var(--ink-primary)]">
                  Hình thức giải quyết mong muốn:
                </label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="rmaType"
                      checked={type === "EXCHANGE"}
                      onChange={() => setType("EXCHANGE")}
                      className="text-[var(--brand)]"
                    />
                    <span>🔄 Đổi sản phẩm mới (In bù đợt mới)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="rmaType"
                      checked={type === "REFUND"}
                      onChange={() => setType("REFUND")}
                      className="text-[var(--brand)]"
                    />
                    <span>💰 Hoàn lại tiền cho số lượng lỗi</span>
                  </label>
                </div>
              </div>

              {/* Reason & Quantity */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                    Lý do yêu cầu đổi trả:
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as RmaReason)}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2"
                  >
                    <option value="PRINT_DEFECT">Lỗi in ấn (Lem màu, sai lệch mẫu duyệt)</option>
                    <option value="SHIPPING_DAMAGE">
                      Hư hỏng vận chuyển (Móp méo thùng carton)
                    </option>
                    <option value="WRONG_QUANTITY">Giao thiếu / không đủ số lượng</option>
                    <option value="WRONG_SPEC">Sai quy cách / dung tích / vật liệu</option>
                    <option value="OTHER">Lý do khác</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                    Số lượng phát hiện lỗi cần đổi/hoàn (cái):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(Number(e.target.value))}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-[var(--ink-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                  Mô tả chi tiết tình trạng sản phẩm:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ghi rõ vị trí lỗi, số lượng từng thùng bị ảnh hưởng..."
                  value={reasonDetail}
                  onChange={(e) => {
                    setReasonDetail(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-[var(--ink-primary)]"
                />
              </div>

              {/* Photo Evidence Simulation */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block font-medium text-[var(--ink-secondary)]">
                    Hình ảnh chụp bằng chứng thực tế ({photoUrls.length} ảnh):
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSamplePhoto}
                    className="flex items-center gap-1 text-[11px] text-sky-600 hover:underline"
                  >
                    <Camera className="h-3 w-3" />
                    <span>+ Thêm ảnh chụp lỗi</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photoUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]"
                    >
                      <Image
                        src={url}
                        alt="Bằng chứng lỗi"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                        Ảnh {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand)] py-2.5 text-xs font-semibold text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
                >
                  <Send className="h-4 w-4" />
                  <span>Xác nhận gửi yêu cầu RMA</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Policy & Guidance */}
          <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
              <FileCheck className="h-4 w-4 text-[var(--brand)]" />
              <span>Chính sách đổi trả hàng StockFlow</span>
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
              <div className="space-y-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <strong className="block text-[var(--ink-primary)]">Thời hạn tiếp nhận:</strong>
                <p>
                  Khách hàng cần phản hồi trong vòng <strong>48 giờ</strong> kể từ thời điểm ký nhận
                  biên bản bàn giao hàng hóa.
                </p>
              </div>

              <div className="space-y-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <strong className="block text-[var(--ink-primary)]">
                  Căn cứ đối chiếu chất lượng:
                </strong>
                <p>
                  Mọi khiếu nại về màu sắc và bố cục sẽ được đối chiếu trực tiếp với{" "}
                  <strong>Bản mẫu thử đã phê duyệt (Approved Sample)</strong>.
                </p>
              </div>

              <div className="space-y-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
                <strong className="block text-[var(--ink-primary)]">
                  Chi phí vận chuyển thu hồi:
                </strong>
                <p>
                  Nếu lỗi do nhà in hoặc khâu vận chuyển của StockFlow, khách hàng được miễn phí
                  100% cước thu hồi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
