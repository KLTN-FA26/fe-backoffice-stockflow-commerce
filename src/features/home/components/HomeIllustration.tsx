import Image from "next/image";

import { HOME_COPY } from "../constants";

/**
 * Ảnh minh hoạ kho vận ở cột phải của hero.
 *
 * `aria-hidden` + alt rỗng: ảnh thuần trang trí, nội dung nghĩa đã nằm ở h1 và
 * đoạn mô tả bên trái — để screen reader đọc lại tên thương hiệu in trong ảnh là thừa.
 */
export function HomeIllustration() {
  return (
    <Image
      src={HOME_COPY.illustrationSrc}
      alt=""
      aria-hidden="true"
      width={560}
      height={560}
      priority
      sizes="(max-width: 1023px) 0px, 40vw"
      className="h-auto w-full max-w-[420px] select-none"
      draggable={false}
    />
  );
}
