import { cn } from "cn";

import type { ReactNode } from "react";

/**
 * Khung panel của trang chi tiết back-office (backoffice-erp-ui B12, kiểu ERP / AWS Console): thanh tiêu
 * đề — tên, số đếm, mô tả ngắn bên trái, nút thao tác bên phải — rồi thân. Mọi khối dữ liệu của trang
 * dùng chung khung này để đọc như một hệ thống, không phải các thẻ rời nhau. `flush`: thân không padding
 * (bảng, lưới ô kẻ). Không chứa nghiệp vụ.
 */
export function DetailPanel({
  title,
  count,
  description,
  actions,
  flush = false,
  className,
  children,
}: {
  title: string;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "border-border-default bg-bg-surface min-w-0 overflow-hidden rounded-(--section-radius) border shadow-(--card-shadow)",
        className,
      )}
    >
      <header className="border-border-default flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-ink-primary text-sm font-semibold">
            {title}
            {count !== undefined && (
              <span className="text-ink-tertiary ml-1.5 font-normal tabular-nums">{count}</span>
            )}
          </h2>
          {description && <p className="text-ink-tertiary mt-0.5 text-xs">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}

/**
 * Lưới thông số (nhãn nhỏ + giá trị) trong panel: khoảng cách thoáng, không kẻ vạch giữa các ô (như
 * form xem chi tiết của SAP Fiori) — đọc theo cột, không lộ ô trống khi số mục lẻ.
 */
export function FactGrid({ columns = 4, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return <dl className={cn("grid grid-cols-1 gap-x-8 gap-y-4", cols)}>{children}</dl>;
}

export function Fact({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd
        className={cn(
          "text-ink-primary text-[0.8125rem] font-medium break-words",
          mono && "font-[family-name:var(--font-mono)] font-normal",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
