"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Custom toast renderer — match components-preview.html §Feedback           */
/*  .toast: border-left 3px solid tone, bg-surface, shadow-lg, r-md          */
/* -------------------------------------------------------------------------- */

const TONE_STYLES = {
  success: {
    borderColor: "var(--positive)",
    icon: <CheckCircle className="text-positive size-4 shrink-0" />,
  },
  error: {
    borderColor: "var(--danger)",
    icon: <XCircle className="text-danger size-4 shrink-0" />,
  },
  warning: {
    borderColor: "var(--warning)",
    icon: <AlertTriangle className="text-warning size-4 shrink-0" />,
  },
  info: { borderColor: "var(--info)", icon: <Info className="text-info size-4 shrink-0" /> },
} as const;

type ToastTone = keyof typeof TONE_STYLES;

function ToastContent({
  tone,
  title,
  description,
}: {
  tone: ToastTone;
  title: string;
  description?: string;
}) {
  const { borderColor, icon } = TONE_STYLES[tone];
  return (
    <div
      className="border-border-default bg-bg-surface flex items-start gap-2.5 rounded-[var(--r-md)] border px-3.5 py-3 shadow-[var(--sh-lg)]"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {icon}
      {/* Mã dài (task, LPN, SKU) tự xuống dòng trong khung thay vì bị cắt */}
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="text-ink-primary text-[0.8125rem] font-semibold">{title}</div>
        {description && <div className="text-ink-secondary mt-0.5 text-xs">{description}</div>}
      </div>
    </div>
  );
}

/**
 * Toast system — wraps sonner. Render <ToastProvider /> once in root layout.
 * Toast style matches components-preview.html: left-border tone, icon, title + message.
 * Góc dưới phải (WF4 UX S01-10): góc trên phải đè lên đường dẫn đầu trang và chuông thông báo.
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        className: "w-full",
        duration: TOAST_DURATION_MS.default,
      }}
    />
  );
}

/** Thông báo thành công / thông tin tự tắt nhanh; lỗi và cảnh báo ở lại lâu hơn để kịp đọc (người lớn tuổi đọc chậm). */
const TOAST_DURATION_MS = { default: 4000, attention: 8000 } as const;

/** `id`: toast mới cùng id thay toast cũ thay vì chồng thêm (vd giữ phím lặp lại cùng một cảnh báo). */
export interface ToastOptions {
  id?: string;
}

function fireToast(tone: ToastTone, title: string, description?: string, options?: ToastOptions) {
  sonnerToast.custom(() => <ToastContent tone={tone} title={title} description={description} />, {
    duration:
      tone === "error" || tone === "warning"
        ? TOAST_DURATION_MS.attention
        : TOAST_DURATION_MS.default,
    ...options,
  });
}

export const toast = {
  success: (title: string, description?: string, options?: ToastOptions) =>
    fireToast("success", title, description, options),
  error: (title: string, description?: string, options?: ToastOptions) =>
    fireToast("error", title, description, options),
  warning: (title: string, description?: string, options?: ToastOptions) =>
    fireToast("warning", title, description, options),
  info: (title: string, description?: string, options?: ToastOptions) =>
    fireToast("info", title, description, options),
};
