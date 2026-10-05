/**
 * Thanh progress mảnh cho trạng thái "refetch nền" (api-conventions §8): dữ liệu cũ vẫn hiện,
 * chỉ báo nhẹ là đang tải lại — không che nội dung, không thay bằng skeleton.
 * Không chứa nghiệp vụ; tôn trọng prefers-reduced-motion (chỉ nhấp nháy khi motion-safe).
 */

import { cn } from "cn";

export function RefetchBar({
  active,
  label,
  className,
}: {
  active: boolean;
  /** Nhãn cho screen reader, vd "Đang tải lại danh sách". */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("h-0.5 w-full overflow-hidden", className)} aria-hidden={!active}>
      {active && (
        <div
          role="progressbar"
          aria-label={label}
          className="bg-accent h-full w-full motion-safe:animate-pulse"
        />
      )}
    </div>
  );
}
