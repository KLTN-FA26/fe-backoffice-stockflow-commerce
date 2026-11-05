import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/shared/Card";

interface ComingSoonPageProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

export function ComingSoonPage({ title, subtitle, icon: Icon }: ComingSoonPageProps) {
  return (
    // Kiểu Vercel như các trang Mode A (globals.css `.surface-soft`): không tiêu đề hiển thị —
    // breadcrumb topbar đã có tên trang và link về tổng quan; h1 giữ cho screen reader.
    <div className="surface-soft">
      <h1 className="sr-only">{title}</h1>
      <Card className="flex min-h-[360px] flex-col items-center justify-center text-center">
        <div className="relative mb-5">
          <div className="bg-accent/8 absolute -inset-5 rounded-full" />
          <div className="bg-accent text-ink-inverse relative flex size-16 items-center justify-center rounded-full shadow-[0_14px_32px_color-mix(in_srgb,var(--accent)_24%,transparent)]">
            <Icon className="size-7" />
          </div>
        </div>
        <div className="text-ink-primary font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.02em]">
          Đang phát triển
        </div>
        <p className="text-ink-secondary mt-2 max-w-md text-[0.8125rem] leading-6">
          {subtitle ??
            `Trang ${title.toLowerCase()} chưa được dựng trong các tiến trình trước. UI sẽ được bổ sung theo đúng Mode A và mock data khi triển khai module này.`}
        </p>
      </Card>
    </div>
  );
}
