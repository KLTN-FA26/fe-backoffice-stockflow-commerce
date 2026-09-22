export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-ink-secondary text-xs font-medium">
      {children} {required && <span className="text-danger">*</span>}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-danger mt-1 text-xs">{message}</p>;
}

export const inputCls =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none";
