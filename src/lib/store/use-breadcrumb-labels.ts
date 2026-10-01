/**
 * Nhãn breadcrumb cho segment id trong URL — UI state toàn cục (zustand, không persist).
 *
 * URL chi tiết dùng id kỹ thuật (vd UUID của BE) nhưng người dùng cần thấy mã nghiệp vụ
 * (vd "SUP-002"). Trang đã tải được record đăng ký `id → nhãn`; shell đọc để hiện breadcrumb.
 */

import { useEffect } from "react";
import { create } from "zustand";

interface BreadcrumbLabelState {
  labels: Record<string, string>;
  setLabel: (id: string, label: string) => void;
  clearLabel: (id: string) => void;
}

export const useBreadcrumbLabelStore = create<BreadcrumbLabelState>()((set) => ({
  labels: {},
  setLabel: (id, label) => set((s) => ({ labels: { ...s.labels, [id]: label } })),
  clearLabel: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.labels;
      void _removed;
      return { labels: rest };
    }),
}));

/** Đăng ký nhãn cho `id` khi trang đang mở; tự gỡ khi rời trang. Bỏ qua nếu chưa có nhãn. */
export function useBreadcrumbLabel(id: string | undefined, label: string | undefined): void {
  const setLabel = useBreadcrumbLabelStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbLabelStore((s) => s.clearLabel);
  useEffect(() => {
    if (!id || !label) return;
    setLabel(id, label);
    return () => clearLabel(id);
  }, [id, label, setLabel, clearLabel]);
}
