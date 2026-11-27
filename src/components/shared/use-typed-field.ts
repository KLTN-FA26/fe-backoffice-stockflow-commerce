"use client";

import { useImperativeHandle, useLayoutEffect, useState } from "react";

import { caretAfterDigits, digitsBefore } from "@/lib/format";

import type { Ref } from "react";

/**
 * Chung cho ô ngày / ngày giờ gõ được (`DatePicker`, `DateTimePicker`):
 * - giữ con trỏ đúng chỗ khi ô tự thêm "/" ":" (sửa giữa chữ không nhảy con trỏ về cuối);
 * - lấy chữ nhãn của ô (`<label htmlFor>`) để nút lịch có tên "Mở lịch – <nhãn>" cho người dùng đọc màn hình.
 */
export function useTypedField(forwardedRef?: Ref<HTMLInputElement>) {
  const [node, setNode] = useState<HTMLInputElement | null>(null);
  // Mỗi lần gõ là một đối tượng mới để effect chạy lại cả khi vị trí con trỏ trùng lần trước
  const [pending, setPending] = useState<{ at: number } | null>(null);

  // Trả ô input thật cho `ref` của caller (react-hook-form `field.ref`…)
  useImperativeHandle(forwardedRef, () => node as HTMLInputElement, [node]);

  // Đặt con trỏ sau khi React vẽ lại giá trị đã định dạng
  useLayoutEffect(() => {
    if (pending && node && document.activeElement === node) {
      node.setSelectionRange(pending.at, pending.at);
    }
  }, [pending, node]);

  // `node` là state (đặt khi ô gắn vào DOM) nên nhãn có ngay ở lần vẽ lại sau đó
  const label = (node?.labels?.[0]?.textContent ?? "").replace(/[*:]/g, "").trim();

  /** Gọi trong `onChange`: nhớ con trỏ theo số chữ số đứng trước nó, để đặt lại sau khi định dạng. */
  const keepCaret = (input: HTMLInputElement, masked: string) => {
    setPending({
      at: caretAfterDigits(
        masked,
        digitsBefore(input.value, input.selectionStart ?? input.value.length),
      ),
    });
  };

  return { attachInput: setNode, keepCaret, label };
}
