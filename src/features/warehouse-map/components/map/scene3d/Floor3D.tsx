"use client";

import { Grid } from "@react-three/drei";

import { boxOf } from "@/features/warehouse-map/selectors";

import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/** Lề mặt hứng bóng quanh kho / kệ đang xem (m). */
const SHADOW_PAD = 2;

/**
 * Nền cảnh như canvas thiết kế: không sàn màu, không mặt đất / chân trời — chỉ lưới kẻ ô (ô 1 m trùng
 * mét bản đồ, đường đậm mỗi 5 m) mờ dần theo khoảng cách camera nên không có mép cứng, cộng một mặt
 * trong suốt chỉ hứng bóng (kho, hoặc kệ đang xem) để vật không lơ lửng. Lưới vẽ bằng shader — một lần
 * vẽ, không thêm hình học theo cỡ kho. Bấm nền trống = bỏ chọn (`onPointerMissed` của Canvas).
 */
export function Floor3D({
  width,
  height,
  palette,
  focus,
}: {
  width: number;
  height: number;
  palette: ScenePalette;
  /** Đang xem một kệ: bóng chỉ quanh kệ, lưới mờ gần hơn cho gọn. */
  focus?: LayoutShelf | null;
}) {
  const span = Math.max(width, height);
  const b = focus ? boxOf(focus.footprint) : { x: 0, y: 0, w: width, h: height };
  return (
    <group>
      <Grid
        position={[width / 2, -0.01, height / 2]}
        args={[span * 6, span * 6]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={palette.gridCell}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={palette.gridSection}
        fadeDistance={focus ? Math.max(b.w, b.h) * 2 + 15 : span * 2.5}
        fadeStrength={1.5}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[b.x + b.w / 2, 0, b.y + b.h / 2]}
        receiveShadow
      >
        <planeGeometry args={[b.w + SHADOW_PAD * 2, b.h + SHADOW_PAD * 2]} />
        <shadowMaterial opacity={0.22} />
      </mesh>
    </group>
  );
}
