"use client";

import { Edges, Html } from "@react-three/drei";

import { boxOf, shelfHeight } from "@/features/warehouse-map/selectors";

import type { LayoutShelf } from "@/features/warehouse-map/types";

/** Khung bao + nhãn mã cho MỘT kệ (đang chọn / đang trỏ) — chỉ vài DOM node thay vì nhãn cho mọi kệ. */
export function ShelfFocus3D({
  shelf,
  color,
  strong,
}: {
  shelf: LayoutShelf;
  color: string;
  /** Đang chọn: viền đậm hơn khi chỉ trỏ chuột. */
  strong: boolean;
}) {
  const b = boxOf(shelf.footprint);
  const top = shelfHeight(shelf) + 0.15;
  return (
    <group position={[b.x + b.w / 2, top / 2, b.y + b.h / 2]}>
      <mesh raycast={() => null}>
        <boxGeometry args={[b.w + 0.12, top, b.h + 0.12]} />
        {/* Kệ đang xem: chỉ khung viền, không phủ màu che thùng hàng */}
        <meshBasicMaterial
          transparent
          opacity={0.05}
          visible={!strong}
          color={color}
          depthWrite={false}
        />
        <Edges color={color} lineWidth={strong ? 2 : 1} />
      </mesh>
      <Html position={[0, top / 2 + 0.25, 0]} center zIndexRange={[20, 10]}>
        <span className="bg-bg-surface text-ink-primary border-border-default pointer-events-none rounded-(--r-sm) border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs whitespace-nowrap shadow-(--sh-sm)">
          {shelf.code}
        </span>
      </Html>
    </group>
  );
}
