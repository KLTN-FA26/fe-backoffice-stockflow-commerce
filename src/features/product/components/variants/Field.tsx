import { Label } from "@/components/ui/label";

/** Nhãn + ô nhập + gợi ý + lỗi inline — dùng chung cho form biến thể và logistics. */
export function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-ink-secondary text-xs font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-ink-tertiary text-xs">{hint}</p>}
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
