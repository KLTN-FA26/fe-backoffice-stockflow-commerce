"use client";

import { cn } from "cn";
import { Monitor, Moon, Sun } from "lucide-react";

import { ACCOUNT_MENU_LABELS as L } from "@/constants";

import { useTheme } from "@/components/theme-provider";

import type { ThemePreference } from "@/components/theme-provider";
import type { KeyboardEvent } from "react";

const OPTIONS = [
  { value: "system", label: L.themeSystem, Icon: Monitor },
  { value: "light", label: L.themeLight, Icon: Sun },
  { value: "dark", label: L.themeDark, Icon: Moon },
] as const satisfies readonly { value: ThemePreference; label: string; Icon: typeof Sun }[];

/**
 * Chọn giao diện 3 mức (hệ thống / sáng / tối) dạng công tắc icon kiểu Vercel. Là `radiogroup`: Tab vào ô
 * đang chọn, mũi tên trái / phải đổi lựa chọn.
 */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  const current = OPTIONS.findIndex((option) => option.value === preference);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = OPTIONS[(current + step + OPTIONS.length) % OPTIONS.length];
    setPreference(next.value);
    const target = event.currentTarget.querySelector<HTMLButtonElement>(
      `[data-value="${next.value}"]`,
    );
    target?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={L.theme}
      onKeyDown={handleKeyDown}
      className="border-border-default bg-bg-subtle inline-flex items-center gap-0.5 rounded-full border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const checked = value === preference;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            data-value={value}
            tabIndex={checked ? 0 : -1}
            onClick={() => setPreference(value)}
            className={cn(
              "focus-visible:ring-border-strong flex size-6 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2",
              checked
                ? "border-border-default bg-bg-surface text-ink-primary shadow-[var(--sh-sm)]"
                : "text-ink-tertiary hover:text-ink-primary border-transparent",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
