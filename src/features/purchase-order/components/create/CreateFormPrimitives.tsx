export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-danger mt-1 text-xs">{children}</p>;
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
