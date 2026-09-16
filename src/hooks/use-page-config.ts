/**
 * Page config persistence — usehooks-ts `useLocalStorage` wrapper.
 *
 * Thay cho pattern cũ lặp ở 6 trang admin:
 *   useState(DEFAULT) + useEffect đọc localStorage + setState + cờ `mounted`
 *   + useEffect ghi ngược lại.
 *
 * Pattern cũ vi phạm `react-hooks/set-state-in-effect` (setState trong effect
 * gây cascading render) và nhấp nháy 1 frame vì render default trước khi đọc
 * được giá trị đã lưu.
 *
 * `useLocalStorage` đọc ngay trong render nên không cần `setMounted`, và chỉ
 * ghi khi setter được gọi — không tự ghi đè default lúc mount.
 */

"use client";

import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

/**
 * @param storageKey — khoá localStorage, vd "stockflow:admin:orders:config"
 * @param defaultConfig — config mặc định khi chưa có gì lưu / parse lỗi
 * @param merge — gộp giá trị đã lưu (có thể thiếu field) với default
 */
export function usePageConfig<T>(
  storageKey: string,
  defaultConfig: T,
  merge: (stored: Partial<T>, fallback: T) => T,
) {
  const [config, setConfig] = useLocalStorage<T>(storageKey, defaultConfig, {
    // Giữ `defaultConfig` làm giá trị SSR để tránh hydration mismatch;
    // client đọc lại localStorage sau khi mount.
    initializeWithValue: false,
    deserializer: (raw) => {
      try {
        return merge(JSON.parse(raw) as Partial<T>, defaultConfig);
      } catch {
        return defaultConfig;
      }
    },
    serializer: (value) => JSON.stringify(value),
  });

  const updateConfig = useCallback(
    (updater: (current: T) => T) => setConfig((current) => updater(current)),
    [setConfig],
  );

  return { config, setConfig, updateConfig };
}
