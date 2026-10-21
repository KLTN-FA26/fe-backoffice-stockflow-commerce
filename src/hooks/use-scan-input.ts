import { useEffect, useState } from "react";

import type { ChangeEvent, FocusEvent, KeyboardEvent, RefObject } from "react";

interface UseScanInputOptions {
  /** Nhận mã đã `trim()`, không rỗng. */
  onScan: (code: string) => void;
  /** Khoá ô (vd đang gửi mã trước) — Enter bị bỏ qua, mở lại thì tự focus. */
  disabled?: boolean;
}

/**
 * Ô quét mã vạch (mode-a-backoffice §4.3): máy quét gõ mã rồi gửi Enter. Enter → gửi + xoá ô,
 * Esc → xoá ô. Ô luôn được focus lại khi mount, sau mỗi lần quét và khi mở khoá — người dùng
 * đeo găng không cần chạm chuột giữa hai lần quét. Ref do component sở hữu (truyền vào `<input>`).
 */
export function useScanInput(
  inputRef: RefObject<HTMLInputElement | null>,
  { onScan, disabled = false }: UseScanInputOptions,
) {
  const [value, setValue] = useState("");

  // preventScroll: trả focus về ô quét không được kéo trang về đầu khi đang xem bảng phía dưới
  useEffect(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  }, [disabled, inputRef]);

  // Focus nằm ở nút / vùng trống (vd vừa bấm thu gọn sidebar, nút "Thử lại" vừa biến mất) → ký tự
  // máy quét gửi tới sẽ mất. Bắt phím ở mức document: ký tự in được mà không gõ vào ô nhập / dialog
  // khác thì chuyển focus về ô quét trước khi trình duyệt chèn ký tự.
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // Bỏ qua phím cách: Space là phím kích hoạt nút / cuộn trang, mã vạch không chứa khoảng trắng
      if (event.key.length !== 1 || event.key === " " || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target === inputRef.current) return;
      if (
        target.isContentEditable ||
        target.closest(
          "input, textarea, select, [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=combobox]",
        )
      ) {
        return;
      }
      inputRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [disabled, inputRef]);

  const submit = () => {
    const code = value.trim();
    if (disabled || code === "") return;
    onScan(code);
    setValue("");
    inputRef.current?.focus();
  };

  return {
    value,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    // "Luôn focus": bấm vào vùng trống / dòng bảng (không phải ô nhập, nút, dialog) → trả focus về ô
    // quét, nếu không mã quét kế tiếp rơi vào `body` và mất. Focus sang phần tử tương tác thì để yên.
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      if (disabled || event.relatedTarget) return;
      // setTimeout (không dùng rAF): rAF dừng khi cửa sổ không vẽ lại → focus không bao giờ quay về
      setTimeout(() => {
        const active = document.activeElement;
        // Đang bôi đen chữ (vd copy mã kiện) → không giành focus, kẻo mất vùng chọn
        if (window.getSelection()?.type === "Range") return;
        if (!active || active === document.body) inputRef.current?.focus({ preventScroll: true });
      }, 0);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      // Đang gõ bằng bộ gõ (IME) → Enter là chốt chữ, không phải máy quét gửi mã
      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        submit();
      } else if (event.key === "Escape") {
        setValue("");
      }
    },
  };
}
