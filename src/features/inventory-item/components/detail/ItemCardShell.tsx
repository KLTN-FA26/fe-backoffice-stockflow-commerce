import { cn } from "cn";

import { Card } from "@/components/shared/Card";

import type { LucideIcon } from "lucide-react";

/**
 * Khung thẻ của trang chi tiết: icon + tiêu đề + nút hành động bên phải — cùng kiểu thẻ trang chi
 * tiết NCC (`supplier-detail/GeneralInfoCard.tsx`).
 */
export function ItemCardShell({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-ink-primary flex items-center gap-2 text-[0.9375rem] font-semibold">
          <Icon className="text-accent size-4" aria-hidden="true" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * Một dòng nhãn / giá trị trong `<dl>`: nhãn trái, giá trị phải, kẻ ngang giữa các dòng — như
 * `supplier-detail/InfoRow.tsx`. `mono` cho mã định danh / số.
 */
export function DefinitionItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-border-default flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-ink-tertiary text-xs font-medium">{label}</dt>
      <dd
        className={cn(
          "text-ink-primary text-right text-[0.8125rem]",
          mono && "font-[family-name:var(--font-mono)] tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
