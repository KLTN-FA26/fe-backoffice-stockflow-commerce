"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "cn";

import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";

/**
 * Content của dialog nằm TRÊN drawer / sheet. `SlideOverPanel` ở lớp drawer (thang z-index
 * design-tokens), còn `DialogContent` shadcn mặc định z-50 nên dialog mở từ trong panel (sửa biến thể,
 * thêm giá trị thuộc tính, xác nhận…) bị panel che. Không sửa `components/ui/*`, nên tự ghép
 * Portal + Overlay + Content cùng thông số shadcn, chỉ đổi lớp lên `--z-dialog-on-drawer` (giữa
 * `--z-drawer` và `--z-toast`).
 * Không có nút đóng góc — dialog dùng chung luôn có nút Huỷ / Đóng trong footer.
 */
export function LayeredDialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Tuỳ biến lớp nền mờ (vd tắt `backdrop-blur` khi dialog mở trên vùng vẽ lớn — bản đồ, canvas). */
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={cn("z-(--z-dialog-on-drawer)", overlayClassName)} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-(--z-dialog-on-drawer) grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
