"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

import { HOME_COPY } from "../constants";

export function HomeFooter() {
  const { theme, toggleTheme } = useTheme();

  return (
    <footer className="border-border-default shrink-0 border-t">
      <div className="text-ink-tertiary mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 text-xs sm:px-6 lg:px-8">
        <span>{HOME_COPY.footerLeft}</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">{HOME_COPY.footerRight}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Chuyển sang Light" : "Chuyển sang Dark"}
            className="border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted hover:text-ink-primary size-8 shrink-0 rounded-[var(--r-sm)] border"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
        </div>
      </div>
    </footer>
  );
}
