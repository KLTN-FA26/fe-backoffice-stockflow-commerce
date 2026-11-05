"use client";

import { Edges } from "@react-three/drei";

import type { SceneTheme } from "../../lib/scene-theme";

/** Vỏ thùng xe (hộp mờ có viền) và lưới sàn — dùng chung cho khung xem và trình soạn xếp tay. */
export function VehicleShell({
  width,
  height,
  depth,
  theme,
}: {
  width: number;
  height: number;
  depth: number;
  theme: SceneTheme;
}) {
  return (
    <>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={theme.shellFill} transparent opacity={0.08} depthWrite={false} />
        <Edges color={theme.shellEdge} />
      </mesh>
      <gridHelper
        key={`${theme.gridMajor}${theme.gridMinor}`}
        args={[Math.max(width, depth), 12, theme.gridMajor, theme.gridMinor]}
        position={[0, -height / 2, 0]}
      />
    </>
  );
}
