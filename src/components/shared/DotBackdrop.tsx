import { cn } from "cn";

/**
 * Nền chấm + đốm màu mờ, dùng chung cho các trang ngoài shell (trang chủ, đăng nhập).
 * Chấm là SVG pattern màu `border.strong`; đốm màu là khối tròn phẳng + `blur` (luật design-tokens:
 * tạo chiều sâu bằng glow/blur + pattern, KHÔNG gradient). Đặt trong phần tử cha `relative`.
 * Panel đặt lên trên dùng `GLASS_PANEL_CLASS` để đốm màu nhoè qua lớp kính.
 */

const DOT_GAP = 22;

/** Khung kính: nền surface trong suốt + blur, viền sáng, bóng lớn. */
export const GLASS_PANEL_CLASS =
  "border-bg-surface/70 bg-bg-surface/35 rounded-[var(--r-lg)] border shadow-[var(--sh-lg)] backdrop-blur-lg backdrop-saturate-150";

/** Thanh kính mảnh (header / footer) — đặc hơn khung để chữ nhỏ vẫn đủ tương phản. */
export const GLASS_BAR_CLASS = "bg-bg-surface/55 backdrop-blur-md";

interface DotBackdropProps {
  /** Khung chứa cụm đốm màu, căn giữa trang — rộng hơn khi bố cục hai cột. */
  glowClassName?: string;
}

export function DotBackdrop({ glowClassName = "size-[min(560px,90vw)]" }: DotBackdropProps) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <svg className="text-border-strong absolute inset-0 size-full" shapeRendering="crispEdges">
        <defs>
          <pattern id="dot-backdrop" width={DOT_GAP} height={DOT_GAP} patternUnits="userSpaceOnUse">
            <rect width="2" height="2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-backdrop)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn("relative", glowClassName)}>
          <div className="bg-accent/35 absolute top-[6%] left-[2%] size-[52%] rounded-full blur-3xl" />
          <div className="bg-dot-positive/30 absolute right-[0%] bottom-[10%] size-[46%] rounded-full blur-3xl" />
          <div className="bg-dot-warning/20 absolute bottom-[0%] left-[18%] size-[34%] rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}
