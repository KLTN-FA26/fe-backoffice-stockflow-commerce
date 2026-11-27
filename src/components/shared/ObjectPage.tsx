import { cn } from "cn";

import { StatusDot } from "@/components/shared/StatusDot";

import type { ReactNode } from "react";

/**
 * Khung bố cục object page ERP dùng chung cho mọi trang chi tiết back-office (backoffice-erp-ui B10–B11), theo mẫu trang
 * chi tiết sản phẩm (`ProductObjectHeader`, `ProductOverviewPanel`). Chỉ bố cục — không nghiệp vụ.
 */

/** UUID dài → `01a2133f…098a`; bản đầy đủ đặt ở `title`. */
export function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function isToneStatus(value: unknown): value is { tone: string; label: string } {
  return typeof value === "object" && value !== null && "tone" in value && "label" in value;
}

/** Đầu trang: tên lớn font display, mã mono rút gọn (đầy đủ ở `title`), trạng thái; việc chính bên phải. */
export function ObjectHeader({
  name,
  code,
  codeLabel,
  status,
  meta,
  actions,
}: {
  name: string;
  code: string;
  codeLabel: string;
  /** Chấm trạng thái (domain `order`), hoặc truyền sẵn một node trạng thái riêng. */
  status: { tone: string; label: string } | ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-2xl leading-tight font-semibold tracking-tight break-words">
          {name}
        </h1>
        <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
          <span
            title={code}
            aria-label={`${codeLabel} ${code}`}
            className="text-accent-text font-[family-name:var(--font-mono)] font-medium"
          >
            {shortId(code)}
          </span>
          {isToneStatus(status) ? (
            <StatusDot domain="order" status={status.tone} label={status.label} size="sm" />
          ) : (
            status
          )}
          {meta}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">{actions}</div>
      )}
    </header>
  );
}

/** Vòng đời nằm ngang ở đầu khung hồ sơ: bước đã qua xanh, bước hiện tại nổi, bước sau mờ. */
export function LifecycleSteps({
  label,
  steps,
  current,
}: {
  label: string;
  steps: readonly string[];
  /** Chỉ số bước hiện tại; bằng `steps.length` = đã qua hết. */
  current: number;
}) {
  return (
    <ol aria-label={label} className="flex min-w-0 flex-wrap items-center gap-y-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="flex items-center">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  active
                    ? "bg-accent ring-accent/25 ring-4"
                    : done
                      ? "bg-positive"
                      : "bg-bg-muted ring-border-strong ring-1",
                )}
              />
              <span
                className={cn(
                  "text-[0.8125rem] whitespace-nowrap",
                  active
                    ? "text-ink-primary font-semibold"
                    : done
                      ? "text-ink-secondary"
                      : "text-ink-tertiary",
                )}
              >
                {step}
              </span>
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-3 h-px w-8 shrink-0",
                  index + 1 <= current ? "bg-positive" : "bg-border-default",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Khung hồ sơ: đầu khung (vòng đời + việc phụ bên phải) → lưới thông số 4 cột ngăn bằng vạch mảnh (`gap-px` trên nền
 * `--table-line`) → phần cuối (mô tả / ghi chú). Số ô nên là bội của 4 để không lộ ô trống.
 */
export function ProfileFrame({
  label,
  head,
  actions,
  footer,
  children,
}: {
  label: string;
  head?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="border-border-default bg-bg-surface mb-5 overflow-hidden rounded-(--section-radius) border shadow-(--card-shadow)"
    >
      {(head || actions) && (
        <div className="border-border-default flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          {head}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-px bg-(--table-line) md:grid-cols-4">{children}</dl>
      {footer && <div className="border-t border-(--table-line) px-4 py-3">{footer}</div>}
    </section>
  );
}

/** Ô thông số của khung hồ sơ — nền surface để vạch `gap-px` hiện thành đường ngăn. */
export function ProfileFact({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-bg-surface min-w-0 space-y-1 px-4 py-3">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary truncate text-[0.8125rem] font-medium" title={title}>
        {children}
      </dd>
    </div>
  );
}
