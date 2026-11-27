"use client";

import { Select } from "@/components/shared/combobox-select";

/**
 * `Select` (combobox gõ để lọc, `combobox-select`) cho ô gắn form (react-hook-form `Controller`).
 * "" không bao giờ là lựa chọn thật của người dùng (mục không có value rỗng) → bỏ qua, để giá trị
 * form đổ vào bằng `reset` (vd trang sửa) không bị xoá và form không bị đánh dấu "đã sửa".
 */
export function FormSelect({ onValueChange, ...props }: React.ComponentProps<typeof Select>) {
  return (
    <Select
      {...props}
      onValueChange={(value) => {
        if (value) onValueChange?.(value);
      }}
    />
  );
}
