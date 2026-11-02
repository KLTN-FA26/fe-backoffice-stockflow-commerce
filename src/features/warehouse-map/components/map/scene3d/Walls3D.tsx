"use client";

import { BOUNDARY_TYPE, WAREHOUSE_MAP_3D as R, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import type { Boundary } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/** Cột khung cửa (m). */
const JAMB = 0.12;
/** Cửa cuốn khi mở còn cuộn lại ở đầu khung (m). */
const ROLLED = 0.35;

/**
 * Tường cắt thấp (`wallCutaway`) như mô hình kiến trúc để nhìn được vào trong kho; cửa dựng khung đủ cao
 * + cửa cuốn: đóng thì hạ kín, mở thì cuộn lên đầu khung (`operationalStatus`). Vạch sàn trước cửa:
 * vàng khi mở, cam khi đóng.
 */
export function Walls3D({
  boundaries,
  palette,
}: {
  boundaries: readonly Boundary[];
  palette: ScenePalette;
}) {
  const doorTop = LIMITS.wallHeight3d * 0.8;
  return (
    <>
      {boundaries.map((boundary) => {
        const dx = boundary.endX - boundary.startX;
        const dz = boundary.endY - boundary.startY;
        const length = Math.hypot(dx, dz);
        const [cx, cz] = [boundary.startX + dx / 2, boundary.startY + dz / 2];
        const rotation: [number, number, number] = [0, -Math.atan2(dz, dx), 0];
        if (boundary.type !== BOUNDARY_TYPE.DOOR)
          return (
            <mesh
              key={boundary.id}
              position={[cx, R.wallCutaway / 2, cz]}
              rotation={rotation}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[length, R.wallCutaway, R.wallThickness]} />
              <meshStandardMaterial color={palette.wall} roughness={0.95} />
            </mesh>
          );
        const closed = boundary.operationalStatus === "CLOSED";
        const panel = closed ? doorTop : ROLLED;
        return (
          <group key={boundary.id} position={[cx, 0, cz]} rotation={rotation}>
            {[-length / 2 + JAMB / 2, length / 2 - JAMB / 2].map((x) => (
              <mesh key={x} position={[x, doorTop / 2, 0]} castShadow>
                <boxGeometry args={[JAMB, doorTop, R.wallThickness + 0.04]} />
                <meshStandardMaterial color={palette.steel} metalness={0.15} roughness={0.45} />
              </mesh>
            ))}
            <mesh position={[0, doorTop - panel / 2, 0]} castShadow>
              <boxGeometry args={[Math.max(length - JAMB * 2, 0.05), panel, 0.05]} />
              <meshStandardMaterial color={palette.deck} metalness={0.6} roughness={0.4} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[0, 0.006, side * R.wallThickness * 1.5]}>
                <boxGeometry args={[length, 0.004, R.tape * 2]} />
                <meshStandardMaterial color={closed ? palette.warning : palette.tape} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}
