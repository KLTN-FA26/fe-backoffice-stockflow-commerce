"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Khoá đóng dialog trong lúc POST / PUT chạy. `onSavingChange` được form gọi ĐỒNG BỘ ngay trước `mutate()`
 * và khi request xong; `whenIdle` đọc ref (không phải state của lần render trước) nên Esc / bấm nền tới
 * ngay sau khi request bắt đầu — trước khi React render lại — vẫn bị chặn. `saving` (state) chỉ để các
 * effect phụ thuộc vào nó chạy lại.
 */
export function useSaveLock() {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const onSavingChange = useCallback((next: boolean) => {
    savingRef.current = next;
    setSaving(next);
  }, []);
  const whenIdle = useCallback(
    (action: () => void) => (savingRef.current ? undefined : action()),
    [],
  );
  return { saving, onSavingChange, whenIdle };
}
