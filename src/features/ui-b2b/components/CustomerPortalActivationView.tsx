"use client";

import { useState } from "react";
import { ArrowLeft, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { b2bRepo } from "../mock-repo";

interface Props {
  initialToken?: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function CustomerPortalActivationView({
  initialToken = "token-invite-gsp",
  onBack,
  onRefresh,
}: Props) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("StockFlow@2026");
  const [confirmPassword, setConfirmPassword] = useState("StockFlow@2026");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [statusResult, setStatusResult] = useState<{ success: boolean; message: string } | null>(
    null,
  );
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp với mật khẩu mới. Vui lòng kiểm tra lại!");
      return;
    }
    setPasswordError(null);
    const res = b2bRepo.activateCustomer(token, password);
    setStatusResult(res);
    if (res.success) {
      onRefresh();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--ink-secondary)] shadow-xs hover:text-[var(--ink-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại Quản lý Khách hàng</span>
        </button>

        <div className="font-mono text-xs text-[var(--ink-tertiary)]">
          Customer Portal Activation Simulator
        </div>
      </div>

      {/* Simulator Switcher Toolbar */}
      <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-xs dark:bg-purple-950/30">
        <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
          <KeyRound className="h-4 w-4 text-purple-600" />
          <span>Mô phỏng các trạng thái liên kết kích hoạt (Token Scenarios):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setToken("token-invite-gsp");
              setStatusResult(null);
            }}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              token === "token-invite-gsp"
                ? "border-purple-600 bg-purple-600 font-bold text-white"
                : "border-purple-300 bg-white text-purple-800 dark:bg-slate-800 dark:text-purple-300"
            }`}
          >
            1. Token Hợp lệ (Golden Spoon)
          </button>
          <button
            onClick={() => {
              setToken("token-expired-bmk");
              setStatusResult(null);
            }}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              token === "token-expired-bmk"
                ? "border-amber-600 bg-amber-600 font-bold text-white"
                : "border-amber-300 bg-white text-amber-800 dark:bg-slate-800 dark:text-amber-300"
            }`}
          >
            2. Token Hết hạn (&gt; 7 ngày)
          </button>
          <button
            onClick={() => {
              setToken("token-active-hlh");
              setStatusResult(null);
            }}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              token === "token-active-hlh"
                ? "border-blue-600 bg-blue-600 font-bold text-white"
                : "border-blue-300 bg-white text-blue-800 dark:bg-slate-800 dark:text-blue-300"
            }`}
          >
            3. Token Đã được sử dụng
          </button>
        </div>
      </div>

      {/* Card Activation Form */}
      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-md">
        <div className="space-y-1 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--ink-primary)]">
            Kích Hoạt Tài Khoản Doanh Nghiệp B2B
          </h2>
          <p className="mx-auto max-w-md text-xs text-[var(--ink-secondary)]">
            Chào mừng bạn đến với Cổng giao dịch điện tử StockFlow Commerce. Vui lòng thiết lập mật
            khẩu bảo mật để truy cập bảng giá và hạn mức công nợ.
          </p>
        </div>

        {/* Removed Guest Checkout Notice */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-[var(--ink-secondary)] dark:border-slate-700 dark:bg-slate-800/80">
          <strong>Lưu ý chính sách B2B:</strong> Hệ thống StockFlow đã loại bỏ chức năng Guest
          Checkout và tự đăng ký vãng lai. Chỉ các tài khoản pháp nhân được Sales xác thực mới được
          cấp quyền đặt hàng và xem bảng giá sỉ.
        </div>

        {/* Status Result Message */}
        {statusResult && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 text-xs ${
              statusResult.success
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
            }`}
          >
            {statusResult.success ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            )}
            <div>
              <div className="text-sm font-bold">
                {statusResult.success ? "KÍCH HOẠT THÀNH CÔNG" : "LIÊN KẾT KHÔNG KHẢ DỤNG"}
              </div>
              <p className="mt-1 leading-relaxed">{statusResult.message}</p>
            </div>
          </div>
        )}

        {/* Activation Form */}
        <form onSubmit={handleActivateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block text-[var(--ink-secondary)]">
              Mã xác thực lời mời (Token ID):
            </label>
            <input
              type="text"
              disabled
              value={token}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-muted)] p-2 font-mono text-[var(--ink-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
              Thiết lập mật khẩu mới (*):
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5 font-mono text-xs text-[var(--ink-primary)]"
              />
            </div>
            <span className="mt-1 block text-[10px] text-[var(--ink-tertiary)]">
              Tối thiểu 8 ký tự gồm chữ hoa, chữ thường và ký tự đặc biệt.
            </span>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[var(--ink-primary)]">
              Xác nhận lại mật khẩu (*):
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5 font-mono text-xs text-[var(--ink-primary)]"
            />
          </div>

          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="terms" className="text-[11px] text-[var(--ink-secondary)]">
              Tôi đại diện cho pháp nhân doanh nghiệp cam kết tuân thủ quy chế thanh toán công nợ và
              các điều khoản giao dịch thương mại của StockFlow.
            </label>
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!agreeTerms}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Kích hoạt tài khoản & Đăng nhập</span>
          </button>
        </form>
      </div>
    </div>
  );
}
