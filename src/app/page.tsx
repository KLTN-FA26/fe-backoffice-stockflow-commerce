import { HomeFooter, HomeHero, HomeIllustration } from "@/features/home";

import { DotBackdrop } from "@/components/shared/DotBackdrop";

/**
 * Trang chủ tĩnh, là cổng vào hệ thống — không scene 3D.
 *
 * `h-dvh` (không phải `min-h-dvh`) + `min-h-0` trên <main>: chiều cao phải BỊ CHẶN
 * thì flex child mới co lại được, nhờ đó footer luôn nằm đúng đáy màn hình và trang
 * không sinh thanh cuộn thừa. `dvh` thay `vh` để thanh địa chỉ trên mobile không
 * cắt mất footer.
 *
 * Ảnh minh hoạ chỉ hiện từ `lg` trở lên: dưới ngưỡng đó không đủ chỗ cho hai cột,
 * và trang chủ ưu tiên phần chữ + CTA. Nền chấm + đốm màu mờ (cùng `DotBackdrop` với trang đăng nhập)
 * (không khung kính — hero đứng thẳng trên nền).
 */
export default function Home() {
  return (
    <div className="bg-bg-base text-ink-primary relative isolate flex h-dvh flex-col overflow-hidden">
      <DotBackdrop glowClassName="h-[min(520px,80vh)] w-[min(1000px,95vw)]" />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center gap-12 overflow-y-auto px-5 py-8 sm:px-6 lg:px-8">
        <HomeHero />
        <div className="hidden shrink-0 lg:block">
          <HomeIllustration />
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
