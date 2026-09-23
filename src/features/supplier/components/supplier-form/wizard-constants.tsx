import { Building2, Contact, Landmark, MapPin } from "lucide-react";
import { cn } from "cn";

export type StepKey = "profile" | "contact" | "address" | "terms";

export const STEPS: { key: StepKey; label: string; icon: typeof Building2 }[] = [
  { key: "profile", label: "Hồ sơ NCC", icon: Building2 },
  { key: "contact", label: "Liên hệ", icon: Contact },
  { key: "address", label: "Địa chỉ", icon: MapPin },
  { key: "terms", label: "Điều khoản & Rà soát", icon: Landmark },
];

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
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div
        className={cn(
          "text-ink-primary mt-1 truncate text-[0.8125rem] font-medium",
          mono && "font-[family-name:var(--font-mono)] tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}
