"use client";

import { Html } from "@react-three/drei";

import { LOCATION_STATUS, WAREHOUSE_MAP_3D as R } from "@/constants";

import { boxOf } from "@/features/warehouse-map/selectors";

import { locationTone, TONE_VAR } from "../tone";

import type { ThreeEvent } from "@react-three/fiber";
import type { LayoutArea } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/** Chiều cao khối vật cản (cột, máy…) — BE chỉ lưu mặt bằng, đủ cao để thấy là không đi qua được. */
const OBSTACLE_HEIGHT = 1.2;

/**
 * Khu vực kẻ trên sàn như kho thật: viền băng keo vàng + lớp phủ mờ; vị trí không ACTIVE thì băng keo
 * và lớp phủ theo tone `effectiveStatus`. Vật cản dựng thành khối. Nhãn tên luôn hiện (khu vực ít).
 */
export function Areas3D({
  areas,
  selectedId,
  palette,
  onSelect,
}: {
  areas: readonly LayoutArea[];
  selectedId: string | null;
  palette: ScenePalette;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {areas.map((area) => {
        const b = boxOf(area.footprint);
        const active = area.effectiveStatus === LOCATION_STATUS.ACTIVE;
        const tone = active
          ? palette.tape
          : palette.css(TONE_VAR[locationTone(area.effectiveStatus)]);
        const selected = area.id === selectedId;
        const t = R.tape;
        // Bốn dải băng keo: [tâm x, tâm z, rộng, sâu]
        const strips: [number, number, number, number][] = [
          [b.x + b.w / 2, b.y + t / 2, b.w, t],
          [b.x + b.w / 2, b.y + b.h - t / 2, b.w, t],
          [b.x + t / 2, b.y + b.h / 2, t, b.h],
          [b.x + b.w - t / 2, b.y + b.h / 2, t, b.h],
        ];
        const select = (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect(area.id);
        };
        return (
          <group key={area.id}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[b.x + b.w / 2, 0.004, b.y + b.h / 2]}
              onClick={select}
              receiveShadow
            >
              <planeGeometry args={[b.w, b.h]} />
              <meshStandardMaterial
                color={selected ? palette.info : tone}
                transparent
                opacity={selected ? 0.3 : 0.12}
                depthWrite={false}
              />
            </mesh>
            {strips.map(([x, z, w, d]) => (
              <mesh key={`${x}-${z}`} position={[x, 0.006, z]} receiveShadow>
                <boxGeometry args={[w, 0.004, d]} />
                <meshStandardMaterial color={selected ? palette.info : tone} roughness={0.6} />
              </mesh>
            ))}
            {area.obstacle && (
              <mesh
                position={[b.x + b.w / 2, OBSTACLE_HEIGHT / 2, b.y + b.h / 2]}
                onClick={select}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[b.w * 0.9, OBSTACLE_HEIGHT, b.h * 0.9]} />
                <meshStandardMaterial color={palette.wall} roughness={0.9} />
              </mesh>
            )}
            <Html position={[b.x + b.w / 2, 0.05, b.y + b.h / 2]} center zIndexRange={[10, 0]}>
              <span className="bg-bg-surface/90 text-ink-secondary pointer-events-none rounded-(--r-sm) px-1 text-xs whitespace-nowrap">
                {area.name}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}
