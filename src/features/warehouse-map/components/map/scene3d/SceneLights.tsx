"use client";

import { Environment, Lightformer } from "@react-three/drei";

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import type { ScenePalette } from "./use-scene-palette";

/**
 * Ánh sáng kho: trời / đất (hemisphere) cho bóng mềm, MỘT đèn hướng đổ bóng phủ vừa khít kho, môi
 * trường phản chiếu dựng một lần từ vài tấm sáng như đèn trần (không tải HDR qua mạng). Cường độ để
 * trầm (đèn + phản chiếu + phơi sáng 0.85) — sáng hơn là sàn trắng loá, màu sơn bạc đi. Không sương mù:
 * ngoài kho là lưới nền, không có đường chân trời.
 */
export function SceneLights({
  width,
  height,
  palette,
}: {
  width: number;
  height: number;
  palette: ScenePalette;
}) {
  const span = Math.max(width, height);
  const shadow = span / 2 + 4;
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <hemisphereLight args={[palette.label, palette.ground, 0.7]} />
      <directionalLight
        position={[width / 2 + span * 0.35, span * 0.9, height / 2 + span * 0.5]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[R.shadowMap, R.shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadow}
        shadow-camera-right={shadow}
        shadow-camera-top={shadow}
        shadow-camera-bottom={-shadow}
        shadow-camera-far={span * 4}
      >
        <object3D attach="target" position={[width / 2, 0, height / 2]} />
      </directionalLight>
      {/* Phản chiếu vừa phải: mạnh quá thì mọi bề mặt ánh trắng, màu nhợt */}
      <Environment resolution={64} frames={1} environmentIntensity={0.3}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 5, 0]}
          rotation-x={Math.PI / 2}
          scale={[10, 10, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[-5, 2, -2]}
          rotation-y={Math.PI / 2}
          scale={[8, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[5, 2, 2]}
          rotation-y={-Math.PI / 2}
          scale={[8, 3, 1]}
        />
      </Environment>
    </>
  );
}
