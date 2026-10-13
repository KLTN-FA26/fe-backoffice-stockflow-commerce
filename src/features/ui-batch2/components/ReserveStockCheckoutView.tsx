"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Clock,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  XCircle,
  Plus,
  ShoppingBag,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { batch2Repo } from "../mock-repo";
import { StockReservationSession } from "../types";

export function ReserveStockCheckoutView() {
  const [session, setSession] = useState<StockReservationSession>(() =>
    batch2Repo.getReservationSession(),
  );
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  // Active countdown timer effect
  useEffect(() => {
    const updateRemaining = () => {
      const current = batch2Repo.getReservationSession();
      setSession({ ...current });
      const diff = Math.max(0, Math.floor((current.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleExtend = () => {
    const updated = batch2Repo.extendReservation();
    setSession({ ...updated });
    setSecondsRemaining(Math.max(0, Math.floor((updated.expiresAt - Date.now()) / 1000)));
  };

  const handleRelease = () => {
    setShowReleaseModal(true);
  };

  const executeRelease = () => {
    const updated = batch2Repo.releaseReservation();
    setSession({ ...updated });
    setSecondsRemaining(0);
    setShowReleaseModal(false);
  };

  const handleReset = () => {
    const updated = batch2Repo.resetReservation();
    setSession({ ...updated });
    setSecondsRemaining(900);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isLowTime = secondsRemaining > 0 && secondsRemaining <= 300; // < 5 mins
  const isExpired =
    secondsRemaining === 0 || session.status === "EXPIRED" || session.status === "RELEASED";

  const totalAmount = session.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
            <Lock className="h-5 w-5 text-emerald-600" />
            <span>
              Giữ Hàng Khi Thanh Toán Storefront (Inventory Reservation at Checkout — SCRUM-212)
            </span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Cơ chế khóa giữ tồn kho tạm thời (15 phút TTL) để tránh race condition bán vượt tồn kho
            (Overselling) trong lúc thanh toán.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] shadow-xs transition-colors hover:text-[var(--ink-primary)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Đặt lại phiên demo 15 phút</span>
        </button>
      </div>

      {/* Countdown Timer Banner */}
      <div
        className={`rounded-lg border p-4 shadow-xs transition-all ${
          isExpired
            ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
            : isLowTime
              ? "animate-pulse border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        }`}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2.5 ${
                isExpired
                  ? "bg-rose-200 dark:bg-rose-900"
                  : isLowTime
                    ? "bg-amber-200 dark:bg-amber-900"
                    : "bg-emerald-200 dark:bg-emerald-900"
              }`}
            >
              {isExpired ? (
                <XCircle className="h-6 w-6 text-rose-700 dark:text-rose-300" />
              ) : isLowTime ? (
                <AlertTriangle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              ) : (
                <Clock className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              )}
            </div>

            <div>
              <div className="text-sm font-bold">
                {isExpired
                  ? "Phiên giữ hàng đã HẾT HẠN hoặc đã HỦY GIỮ TỒN KHO"
                  : isLowTime
                    ? "Sắp hết thời gian giữ hàng! Vui lòng hoàn tất thanh toán"
                    : "Tồn kho của bạn đang được BẢO LƯU AN TOÀN"}
              </div>
              <p className="mt-0.5 text-xs opacity-90">
                {isExpired
                  ? "Lượng phôi hàng đã được hoàn trả lại về kho ATP. Hãy gia hạn hoặc tạo phiên mới."
                  : `Mã phiên giữ kho: ${session.reservationId} · Tự động giải phóng nếu không hoàn tất thanh toán.`}
              </p>
            </div>
          </div>

          {/* Live Countdown Display */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="block text-[10px] font-semibold tracking-wider uppercase">
                Thời gian còn lại
              </span>
              <span className="font-mono text-2xl font-bold tracking-tight">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

            {!isExpired && (
              <button
                onClick={handleExtend}
                className="rounded-md border border-current bg-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors hover:bg-slate-50 dark:bg-slate-900"
                title="Gia hạn thêm 5 phút"
              >
                +5 Phút
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Cart Items & Reservation Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Reserved Cart Lines */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
              <ShoppingBag className="h-4 w-4 text-[var(--brand)]" />
              <span>Các mặt hàng đang được giữ trong phiên ({session.items.length} mặt hàng)</span>
            </h3>
            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ● Trạng thái: {session.status}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-default)]">
            {session.items.map((item) => (
              <div
                key={item.sku}
                className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--ink-primary)]">{item.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[var(--ink-secondary)]">
                        {item.sku}
                      </span>
                      <span className="py-0.2 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <ShieldCheck className="h-3 w-3" />
                        <span>ĐÃ KHÓA GIỮ: {item.quantity.toLocaleString()}</span>
                      </span>
                    </div>
                    {item.lotAllocated && (
                      <div className="mt-0.5 font-mono text-[10px] text-indigo-700 dark:text-indigo-400">
                        Phân bổ từ: {item.lotAllocated}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-right sm:flex-col sm:items-end sm:text-right">
                  <span className="font-mono text-xs font-bold text-[var(--ink-primary)]">
                    {(item.quantity * item.unitPrice).toLocaleString()} đ
                  </span>
                  <span className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                    {item.quantity.toLocaleString()} x {item.unitPrice.toLocaleString()} đ
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-4 text-sm">
            <span className="font-semibold text-[var(--ink-primary)]">
              Tổng giá trị đơn tạm tính:
            </span>
            <span className="font-mono text-base font-bold text-[var(--brand)]">
              {totalAmount.toLocaleString()} đ
            </span>
          </div>
        </div>

        {/* Right: Reservation Controls & Policy Explanations */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
            Thao tác Quản trị Phiên
          </h3>

          <div className="space-y-2">
            {!isExpired && (
              <>
                <button
                  onClick={handleExtend}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 p-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Kéo dài thời gian giữ (+5 phút)</span>
                </button>

                <button
                  onClick={handleRelease}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Hủy giữ hàng ngay (Release Stock)</span>
                </button>
              </>
            )}

            {isExpired && (
              <button
                onClick={handleReset}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand)] p-2.5 text-xs font-semibold text-[var(--ink-inverse)] shadow-xs transition-colors hover:bg-[var(--brand-hover)]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Khởi tạo phiên giữ hàng mới (15 phút)</span>
              </button>
            )}
          </div>

          {/* Architecture Note */}
          <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
            <div className="flex items-center gap-1.5 font-bold text-[var(--ink-primary)]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Quy tắc vận hành kỹ thuật (WBS 3.14.5):</span>
            </div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Idempotent:</strong> Mỗi phiên gắn với một UUID duy nhất để tránh việc
                double-hold khi shopper refresh trang.
              </li>
              <li>
                <strong>Reservation Sweeper:</strong> Tự động quét và giải phóng tồn kho về trạng
                thái AVAILABLE sau khi hết hạn 15 phút.
              </li>
              <li>
                <strong>Giả định Demo:</strong> Thời hạn giữ tồn kho 15 phút (900s) là tham số cấu
                hình demo theo quy tắc Odoo e-Commerce reservation TTL, có thể cấu hình linh hoạt
                theo từng chiến dịch.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Releasing Stock Reservation */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--ink-primary)]">
                  Giải phóng lượng tồn kho giữ chỗ?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  Lượng tồn kho đang giữ tạm thời (500 cái) sẽ được hoàn trả ngay lập tức vào kho
                  khả dụng. Các khách hàng khác trên hệ thống có thể đặt mua hết số lượng này và đơn
                  hàng của bạn sẽ không còn được đảm bảo.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-3">
              <button
                type="button"
                onClick={() => setShowReleaseModal(false)}
                className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)]"
              >
                Giữ lại giỏ hàng
              </button>
              <button
                type="button"
                onClick={executeRelease}
                className="rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
              >
                Xác nhận giải phóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
