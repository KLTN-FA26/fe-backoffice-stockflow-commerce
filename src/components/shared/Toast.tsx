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
      <div>
        <div className="text-ink-primary text-[0.8125rem] font-semibold">{title}</div>
        {description && <div className="text-ink-secondary mt-0.5 text-xs">{description}</div>}
      </div>
    </div>
  );
}

/**
 * Toast system — wraps sonner. Render <ToastProvider /> once in root layout.
 * Toast style matches components-preview.html: left-border tone, icon, title + message.
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        unstyled: true,
        className: "w-full",
        duration: 4000,
      }}
    />
  );
}

/** `id`: toast mới cùng id thay toast cũ thay vì chồng thêm (vd giữ phím lặp lại cùng một cảnh báo). */
export interface ToastOptions {
  id?: string;
}

function fireToast(tone: ToastTone, title: string, description?: string, options?: ToastOptions) {
  sonnerToast.custom(
    () => <ToastContent tone={tone} title={title} description={description} />,
    options,
  );
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
