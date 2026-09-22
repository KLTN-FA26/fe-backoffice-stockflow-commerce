import { cn } from "cn";

import type { SupplierDto } from "@/features/supplier/types";

import { AddressBlock } from "./DetailBlocks";

export function InfoRow({
  label,
  value,
  mono,
  danger,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border-default flex items-baseline justify-between border-b py-2 last:border-b-0">
      <span className="text-ink-tertiary text-xs font-medium">{label}</span>
      {children ? (
        <span className="text-ink-primary text-[0.8125rem]">{children}</span>
      ) : (
        <span
          className={cn(
            "text-[0.8125rem]",
            danger ? "text-danger font-medium" : "text-ink-primary",
            mono && "font-[family-name:var(--font-mono)] tabular-nums",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export { AddressBlock };
export type { SupplierDto };
