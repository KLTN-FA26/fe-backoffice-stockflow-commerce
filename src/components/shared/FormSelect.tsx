"use client";

import { Select } from "@/components/ui/select";

/**
 * `Select` cho ô gắn form (react-hook-form `Controller`). Radix Select gọi `onValueChange("")` khi
 * giá trị được đặt sau lúc mount (form đổ dữ liệu bằng `reset`, vd trang sửa) mà danh sách option
 * chưa dựng — làm mất giá trị đã có và đánh dấu form "đã sửa". Radix không cho `SelectItem` có value
 * rỗng nên "" không bao giờ là lựa chọn thật của người dùng → bỏ qua. Không sửa `components/ui/*`.
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
