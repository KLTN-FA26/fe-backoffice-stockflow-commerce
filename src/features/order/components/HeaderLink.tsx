import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

/** Link điều hướng ở vùng action của PageHeader — dạng nút outline (focus-visible của Button). */
export function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className="rounded-[var(--r-sm)]">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
