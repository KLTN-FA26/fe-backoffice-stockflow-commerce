/**
 * Global app store — zustand.
 *
 * Persists warehouse selection, sidebar, theme, locale, sound.
 * Role impersonation lives in auth-store.ts (not here) to keep
 * auth concerns co-located.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WarehouseId } from "@/lib/mock-data";

export interface AppState {
  /* ── Warehouse ─────────────────────────────────────────────────────── */
  warehouseId: WarehouseId | null;
  setWarehouseId: (id: WarehouseId | null) => void;

  /* ── Sidebar ───────────────────────────────────────────────────────── */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  /* ── Theme ─────────────────────────────────────────────────────────── */
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;

  /* ── Locale ────────────────────────────────────────────────────────── */
  locale: "vi" | "en";
  setLocale: (l: "vi" | "en") => void;

  /* ── Sound ─────────────────────────────────────────────────────────── */
  muted: boolean;
  toggleMuted: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      warehouseId: null,
      setWarehouseId: (id) => set({ warehouseId: id }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      theme: "system",
      setTheme: (theme) => set({ theme }),

      locale: "vi",
      setLocale: (locale) => set({ locale }),

      muted: false,
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: "stockflow-app",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        warehouseId: state.warehouseId,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        locale: state.locale,
        muted: state.muted,
      }),
    },
  ),
);
