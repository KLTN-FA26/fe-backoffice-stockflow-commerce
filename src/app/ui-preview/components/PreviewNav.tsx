"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  Factory,
  Share2,
  Briefcase,
  Home,
  AlertTriangle,
  ExternalLink,
  Layers,
} from "lucide-react";

export function PreviewNav() {
  const pathname = usePathname();

  const links = [
    {
      href: "/ui-preview",
      label: "Tổng quan",
      icon: Home,
      exact: true,
    },
    {
      href: "/ui-preview/samples-production",
      label: "Mẫu & Sản xuất",
      icon: FlaskConical,
    },
    {
      href: "/ui-preview/workshop",
      label: "Xưởng in & QC",
      icon: Factory,
    },
    {
      href: "/ui-preview/subcontract",
      label: "Gia công ngoài",
      icon: Share2,
    },
    {
      href: "/ui-preview/b2b",
      label: "B2B Báo giá",
      icon: Briefcase,
    },
    {
      href: "/ui-preview/batch2",
      label: "Mở rộng (Batch 2)",
      icon: Layers,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs">
      {/* Top Alert Banner */}
      <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>DỮ LIỆU DEMO — CHƯA KẾT NỐI API:</strong> Chế độ xem trước giao diện độc lập
            (In-memory mock). Không yêu cầu đăng nhập và không sửa đổi dữ liệu thật.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-amber-500/20"
          >
            <span>Vào Backoffice thật</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/ui-preview"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--ink-primary)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand)] font-mono text-xs font-bold text-[var(--ink-inverse)]">
              SF
            </span>
            <span>StockFlow UI Preview</span>
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              Mock Preview
            </span>
          </Link>
        </div>

        {/* Group tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 text-xs lg:overflow-visible">
          {links.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border border-[var(--border-strong)] bg-[var(--bg-muted)] font-semibold text-[var(--ink-primary)]"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-[var(--accent)]" : "text-[var(--ink-tertiary)]"}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
