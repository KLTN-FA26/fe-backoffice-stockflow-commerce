import { UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";

import { fieldClass } from "./helpers";

/** Lỗi inline dưới ô — `id` để ô nhập trỏ `aria-describedby` tới (đọc được bởi screen reader). */
export function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1 text-xs">
      {children}
    </p>
  );
}

export function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
        {title}
      </h2>
      <p className="text-ink-secondary mt-1 text-[0.8125rem]">{description}</p>
    </div>
  );
}

export function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const cls = mono ? "font-[family-name:var(--font-mono)] tabular-nums" : "";
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div className={`text-ink-primary mt-1 truncate text-[0.8125rem] font-medium ${cls}`}>
        {value}
      </div>
    </div>
  );
}

/** Danh sách lỗi của bước hiện tại (không render gì khi không có lỗi). */
export function StepIssues({ issues, title }: { issues: readonly string[]; title: string }) {
  if (issues.length === 0) return null;
  return (
    <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
      <div className="font-semibold">{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {issues.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ô chỉ đọc của màn sửa nháp — BR-07 (docs 02 §6): NCC và tiền tệ cố định theo PO, BE
 * `PUT /purchase-orders/{id}` không nhận hai trường này. Không có đường đổi nào trên UI.
 */
export function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label}
      </label>
      <Input
        id={id}
        readOnly
        value={value}
        aria-describedby={`${id}-hint`}
        className={`${fieldClass()} bg-bg-muted text-ink-secondary`}
      />
      <p id={`${id}-hint`} className="text-ink-tertiary mt-1 text-xs">
        {UI_LABELS.purchaseOrder.draftEdit.readOnlyHint}
      </p>
    </div>
  );
}
