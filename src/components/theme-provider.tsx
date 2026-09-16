"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useAppStore } from "@/lib/store/use-app-store";

export type ColorTheme = "light" | "dark";
type ThemePreference = ColorTheme | "system";

interface ThemeContextValue {
  /** Theme đã resolve (system → light/dark thật) — dùng để render UI. */
  theme: ColorTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Key mà zustand `persist` middleware dùng cho `useAppStore` (xem use-app-store.ts). */
const APP_STORE_KEY = "stockflow-app";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * Inline script chạy trước paint để tránh flash-of-wrong-theme.
 *
 * Phải tự đọc localStorage + `matchMedia` ở đây (không thể chờ React/zustand
 * rehydrate) vì lúc này chưa có JS framework nào chạy — chỉ có cách này mới
 * kịp set `data-theme` trước khi trình duyệt paint frame đầu tiên.
 */
const THEME_INIT_SCRIPT = `
(function(){
  try{
    var stored = localStorage.getItem('${APP_STORE_KEY}');
    var pref = 'system';
    if (stored) {
      var parsed = JSON.parse(stored);
      pref = (parsed && parsed.state && parsed.state.theme) || 'system';
    }
    var resolved = pref === 'system'
      ? (matchMedia('${DARK_MEDIA_QUERY}').matches ? 'dark' : 'light')
      : pref;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }catch(e){}
})();
`;

/**
 * Tắt mọi CSS transition trên toàn trang, chạy callback, rồi bật lại sau 1 frame.
 * Tránh hiệu ứng lag khi chuyển theme (hàng trăm element animate cùng lúc).
 */
function disableTransitionsWhile(fn: () => void) {
  const el = document.documentElement;
  el.classList.add("no-transitions");
  fn();
  // Force reflow rồi gỡ class sau 1 frame
  void el.offsetHeight;
  requestAnimationFrame(() => {
    el.classList.remove("no-transitions");
  });
}

function applyTheme(resolved: ColorTheme) {
  disableTransitionsWhile(() => {
    const el = document.documentElement;
    el.dataset.theme = resolved;
    el.classList.toggle("dark", resolved === "dark");
  });
}

/**
 * `useSyncExternalStore` cho `prefers-color-scheme` — đây là external system
 * thật sự (browser media query), nên subscribe qua đây thay vì setState
 * trong effect (tránh cascading render, đúng khuyến nghị React).
 */
function subscribeToSystemScheme(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemSchemeSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function getSystemSchemeServerSnapshot(): boolean {
  return false;
}

function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ColorTheme {
  if (preference !== "system") return preference;
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Nguồn sự thật duy nhất cho theme là `useAppStore.theme` (persist vào
 * localStorage qua zustand). Provider này chỉ resolve "system" → light/dark
 * thật (qua `useSyncExternalStore`, không tự giữ state riêng) và đồng bộ DOM.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppStore((state) => state.theme);
  const setPreference = useAppStore((state) => state.setTheme);

  // Đọc trực tiếp media query hiện tại — không cascading setState, tự re-render
  // khi OS đổi prefers-color-scheme nhờ useSyncExternalStore.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemScheme,
    getSystemSchemeSnapshot,
    getSystemSchemeServerSnapshot,
  );

  const theme = resolveTheme(preference, systemPrefersDark);

  // Đồng bộ DOM mỗi khi theme resolve đổi (preference đổi, hoặc OS đổi scheme).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Toggle thủ công = người dùng chọn rõ ràng → ghi light/dark cụ thể vào
  // store (không còn "system"), đúng ý lưu lựa chọn hiện tại của họ.
  const toggleTheme = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* Script chống flash — render ngay trong head */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
