"use client";

import { useEffect, useRef, useState } from "react";

import { DraftSaveError } from "@/features/warehouse-map/draft-save";
import { warehouseMapErrorMessage } from "@/features/warehouse-map/errors";
import { useSaveMapDraft } from "@/features/warehouse-map/mutations";

import type { MapEditor } from "./use-map-editor";

/**
 * Lưu toàn bộ bản nháp: tiến độ từng bước, lỗi dừng giữa chừng (phần đã lưu được ghi nhận vào bản nháp
 * để lần lưu sau chỉ gửi phần còn lại). Còn thay đổi chưa lưu thì trình duyệt cảnh báo khi đóng tab.
 */
export function useDraftSave(editor: MapEditor, warehouseId: string, onSaved: () => void) {
  const save = useSaveMapDraft();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = editor.changes > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // `progress` chỉ có sau khi mutationFn chạy → khoá ngay lúc bấm, chặn Ctrl+S / bấm đúp lưu hai lần
  const running = useRef(false);

  const run = () => {
    if (running.current) return;
    running.current = true;
    setError(null);
    save.mutate(
      {
        warehouseId,
        draft: editor.draft,
        onProgress: (done, total) => setProgress({ done, total }),
      },
      {
        onSuccess: onSaved,
        onError: (cause) => {
          if (cause instanceof DraftSaveError) editor.dispatch({ type: "synced", ...cause.result });
          setError(warehouseMapErrorMessage(cause));
        },
        onSettled: () => {
          running.current = false;
          setProgress(null);
        },
      },
    );
  };

  return { run, progress, error, dirty };
}
