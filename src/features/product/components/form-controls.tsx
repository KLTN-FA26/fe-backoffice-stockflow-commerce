import { cn } from "@/lib/utils";

import {
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { ComponentProps } from "react";

/**
 * Ô nhập Mode A của mọi form / dialog thuộc feature sản phẩm (form sản phẩm, thuộc tính, trục, biến
 * thể) — class lấy từ định nghĩa dùng chung `components/shared/form-control-classes` (cùng thông số
 * form NCC / PO / hồ sơ hàng tồn); không sửa `components/ui/*` (shadcn mặc định `rounded-lg`).
 */
export const PRODUCT_INPUT_CLASS = FORM_INPUT_CLASS;
export const PRODUCT_SELECT_CLASS = FORM_SELECT_CLASS;
export const PRODUCT_TEXTAREA_CLASS = FORM_TEXTAREA_CLASS;

/** `Input` shadcn mang class Mode A; `className` truyền thêm được gộp sau (thắng khi trùng thuộc tính). */
export function ProductInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn(PRODUCT_INPUT_CLASS, className)} {...props} />;
}

export function ProductTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return <Textarea className={cn(PRODUCT_TEXTAREA_CLASS, className)} {...props} />;
}

export function ProductSelectTrigger({
  className,
  ...props
}: ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger className={cn(PRODUCT_SELECT_CLASS, className)} {...props} />;
}
