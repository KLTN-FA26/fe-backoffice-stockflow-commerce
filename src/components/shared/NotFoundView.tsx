import Link from "next/link";
import { cn } from "cn";
import { SearchX } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

const L = UI_LABELS.notFound;

export interface NotFoundAction {
  href: string;
  label: string;
}

/**
 * Nội dung trang "Không tìm thấy" bằng tiếng Việt kèm các nút đi tiếp (thay trang 404 mặc định tiếng Anh, không có đường
 * ra). Không chứa nghiệp vụ — nơi dùng truyền các nút; nút đầu là nút chính. `header` là khung phía trên (logo / trình đơn).
 */
export function NotFoundView({
  actions,
  header,
  fullPage = false,
}: {
  actions: NotFoundAction[];
  header?: ReactNode;
  /** Đứng một mình (không nằm trong khung quản trị) → cao đủ màn hình. */
  fullPage?: boolean;
}) {
  // Trong khung quản trị đã có <main> của khung: ở đó chỉ là một vùng (section), không lồng thêm <main>
  const Content = fullPage ? "main" : "section";
  return (
    <div
      className={cn(
        "text-ink-primary flex flex-col",
        fullPage ? "bg-bg-base min-h-dvh" : "min-h-[60vh]",
      )}
    >
      {header}
      <Content className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <SearchX className="text-ink-tertiary size-10" aria-hidden="true" />
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">{L.title}</h1>
        <p className="text-ink-secondary max-w-[46ch] text-sm">{L.description}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, index) => (
            <Button key={action.href} asChild variant={index === 0 ? "default" : "outline"}>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </Content>
    </div>
  );
}
