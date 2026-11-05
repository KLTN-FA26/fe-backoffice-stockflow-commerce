"use client";

import { TriangleAlert } from "lucide-react";

import { Logo } from "@/components/shared/Logo";

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-mode="storefront"
      className="bg-bg-base text-ink-primary flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="bg-bg-surface border-border-default w-full max-w-md space-y-5 rounded-[var(--r-xl)] border p-6 shadow-[var(--sh-md)] sm:p-8">
        <Logo height={32} />
        {children}
      </div>
    </main>
  );
}

export function InvalidLink({ message }: { message: string }) {
  return (
    <div role="alert" className="space-y-3">
      <TriangleAlert className="text-warning size-8" aria-hidden="true" />
      <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
        Link kích hoạt không dùng được
      </h1>
      <p className="text-ink-secondary text-sm">{message}</p>
    </div>
  );
}
