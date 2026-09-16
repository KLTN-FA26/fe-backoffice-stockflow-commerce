"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { APP_ROUTES, BRAND } from "@/constants";

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

import { HOME_COPY } from "../constants";

export function HomeHero() {
  return (
    <div className="flex max-w-2xl flex-col">
      <div className="mb-7 flex items-center gap-5">
        <Link
          href={APP_ROUTES.home}
          aria-label={`${BRAND.name} — trang chủ`}
          className="focus-visible:ring-border-strong flex w-fit items-center gap-4 rounded-[var(--r-sm)] focus-visible:ring-2"
        >
          <Logo variant="mark" height={112} decorative />
          {/* "Commerce" xuống dòng riêng — lấy từ BRAND.wordmark, không gõ tay chuỗi. */}
          <span className="text-ink-primary font-[family-name:var(--font-display)] text-3xl leading-[1.05] font-bold tracking-tight sm:text-4xl">
            <span className="block">
              {BRAND.wordmark.primary}
              {BRAND.wordmark.accent}
            </span>
            <span className="block">{BRAND.wordmark.suffix}</span>
          </span>
        </Link>
      </div>

      <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-3xl leading-[1.12] font-bold tracking-tight text-balance sm:text-[2.5rem]">
        {HOME_COPY.titleLead} <span className="block">{HOME_COPY.titleAccent}</span>
      </h1>

      <p className="text-ink-secondary mt-4 max-w-[52ch] text-sm leading-6 sm:text-base sm:leading-7">
        {HOME_COPY.description}
      </p>

      {/* CTA tách khỏi hint bằng divider — hint không bị hút vào nút. */}
      <div className="border-border-default mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-5">
        <Button
          asChild
          size="lg"
          className="bg-brand hover:bg-brand-hover text-ink-inverse group h-10 rounded-[var(--r-sm)] px-4 text-sm font-semibold transition-colors"
        >
          <Link href={APP_ROUTES.login}>
            {HOME_COPY.ctaLabel}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </Button>
        <span className="text-ink-tertiary text-xs sm:text-sm">{HOME_COPY.ctaHint}</span>
      </div>
    </div>
  );
}
