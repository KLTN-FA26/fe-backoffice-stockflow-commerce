import type { ReactNode } from "react";

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

/** Ô thông tin nhỏ (nhãn + giá trị), `mono` cho mã / số. */
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
        className={`text-ink-primary mt-0.5 truncate text-[0.8125rem] font-medium ${mono ? "font-[family-name:var(--font-mono)] tabular-nums" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export const NUM = "font-[family-name:var(--font-mono)] tabular-nums text-right";
