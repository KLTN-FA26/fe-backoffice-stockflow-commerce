import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

export const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
export const NUM = `${MONO} text-right`;

export function fieldClass(hasError = false): string {
  return cn(
    "h-8 w-full rounded-[var(--r-sm)] border bg-bg-surface px-2.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError
      ? "border-danger focus:border-danger focus-visible:ring-2 focus-visible:ring-danger/20"
      : "border-border-default focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
  );
}

/** Đã có dữ liệu nhưng tải lại nền thất bại → giữ màn đang làm (vd đang quét), chỉ báo nhỏ. */
export function RefetchErrorNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert tone="warning" className="mb-3 print:hidden">
      {UI_LABELS.shipping.refetchFailed}{" "}
      <Button variant="link" size="sm" onClick={onRetry} className="h-auto p-0">
        {UI_LABELS.common.retry}
      </Button>
    </Alert>
  );
}

/** Lỗi inline dưới ô — `id` để ô nhập trỏ `aria-describedby` tới. */
export function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1 text-xs">
      {children}
    </p>
  );
}

/** Khối nội dung Mode A: nền surface, viền mảnh, tiêu đề nhỏ + hành động bên phải. */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{title}</h2>
          {description && (
            <p className="text-ink-secondary mt-0.5 text-[0.8125rem]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function InfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div
        className={cn(
          // In biên bản: không cắt chữ "…" trên tài liệu ký
          "text-ink-primary mt-0.5 truncate text-[0.8125rem] font-medium print:whitespace-normal",
          mono && MONO,
        )}
      >
        {value}
      </div>
    </div>
  );
}
