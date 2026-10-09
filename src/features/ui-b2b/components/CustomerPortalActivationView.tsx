"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Building2,
  Clock,
  ExternalLink
} from "lucide-react";
import { b2bRepo } from "../mock-repo";

interface Props {
  initialToken?: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function CustomerPortalActivationView({ initialToken = "token-invite-gsp", onBack, onRefresh }: Props) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("StockFlow@2026");
  const [confirmPassword, setConfirmPassword] = useState("StockFlow@2026");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [statusResult, setStatusResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp");
      return;
    }
    const res = b2bRepo.activateCustomer(token, password);
    setStatusResult(res);
    if (res.success) {
      onRefresh();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
        <button
          onClick={onBack}
          className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] shadow-xs flex items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại Quản lý Khách hàng</span>
        </button>

        <div className="text-xs text-[var(--ink-tertiary)] font-mono">
          Customer Portal Activation Simulator
        </div>
      </div>

      {/* Simulator Switcher Toolbar */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/60 dark:bg-purple-950/30 p-3 text-xs space-y-2">
        <div className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
          <KeyRound className="h-4 w-4 text-purple-600" />
          <span>Mô phỏng các trạng thái liên kết kích hoạt (Token Scenarios):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setToken("token-invite-gsp");
              setStatusResult(null);
            }}
            className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
              token === "token-invite-gsp"
                ? "bg-purple-600 text-white border-purple-600 font-bold"
                : "bg-white dark:bg-slate-800 text-purple-800 dark:text-purple-300 border-purple-300"
            }`}
          >
            1. Token Hợp lệ (Golden Spoon)
          </button>
          <button
            onClick={() => {
              setToken("token-expired-bmk");
              setStatusResult(null);
            }}
            className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
              token === "token-expired-bmk"
                ? "bg-amber-600 text-white border-amber-600 font-bold"
                : "bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border-amber-300"
            }`}
          >
            2. Token Hết hạn (&gt; 7 ngày)
          </button>
          <button
            onClick={() => {
              setToken("token-active-hlh");
              setStatusResult(null);
            }}
            className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
              token === "token-active-hlh"
                ? "bg-blue-600 text-white border-blue-600 font-bold"
                : "bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-300 border-blue-300"
            }`}
          >
            3. Token Đã được sử dụng
          </button>
        </div>
      </div>

      {/* Card Activation Form */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-md space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-[var(--ink-primary)]">
            Kích Hoạt Tài Khoản Doanh Nghiệp B2B
          </h2>
          <p className="text-xs text-[var(--ink-secondary)] max-w-md mx-auto">
            Chào mừng bạn đến với Cổng giao dịch điện tử StockFlow Commerce. Vui lòng thiết lập mật khẩu bảo mật để truy cập bảng giá và hạn mức công nợ.
          </p>
        </div>

        {/* Removed Guest Checkout Notice */}
        <div className="rounded-md bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200 dark:border-slate-700 text-xs text-[var(--ink-secondary)]">
          <strong>Lưu ý chính sách B2B:</strong> Hệ thống StockFlow đã loại bỏ chức năng Guest Checkout và tự đăng ký vãng lai. Chỉ các tài khoản pháp nhân được Sales xác thực mới được cấp quyền đặt hàng và xem bảng giá sỉ.
        </div>

        {/* Status Result Message */}
        {statusResult && (
          <div
            className={`rounded-lg p-4 text-xs border flex items-start gap-3 ${
              statusResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300"
            }`}
          >
            {statusResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                {statusResult.success ? "KÍCH HOẠT THÀNH CÔNG" : "LIÊN KẾT KHÔNG KHẢ DỤNG"}
              </div>
              <p className="mt-1 leading-relaxed">{statusResult.message}</p>
            </div>
          </div>
        )}

        {/* Activation Form */}
        <form onSubmit={handleActivateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[var(--ink-secondary)] mb-1">Mã xác thực lời mời (Token ID):</label>
            <input
              type="text"
              disabled
              value={token}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-muted)] p-2 font-mono text-[var(--ink-primary)]"
            />
          </div>

          <div>
            <label className="block text-[var(--ink-primary)] font-semibold mb-1">Thiết lập mật khẩu mới (*):</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--ink-primary)] font-mono"
              />
            </div>
            <span className="text-[10px] text-[var(--ink-tertiary)] mt-1 block">Tối thiểu 8 ký tự gồm chữ hoa, chữ thường và ký tự đặc biệt.</span>
          </div>

          <div>
            <label className="block text-[var(--ink-primary)] font-semibold mb-1">Xác nhận lại mật khẩu (*):</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--ink-primary)] font-mono"
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
              Tôi đại diện cho pháp nhân doanh nghiệp cam kết tuân thủ quy chế thanh toán công nợ và các điều khoản giao dịch thương mại của StockFlow.
            </label>
          </div>

          <button
            type="submit"
            disabled={!agreeTerms}
            className="w-full rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 shadow-md transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Kích hoạt tài khoản & Đăng nhập</span>
          </button>
        </form>
      </div>
    </div>
  );
}
