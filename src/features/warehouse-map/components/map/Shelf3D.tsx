"use client";

import { Html } from "@react-three/drei";

import { LOCATION_STATUS } from "@/constants";

import { levelSpan, shelfHeight, shelfTransform } from "@/features/warehouse-map/selectors";

import { locationTone, TONE_VAR } from "./tone";

import type { ThreeEvent } from "@react-three/fiber";
import type { LayoutShelf } from "@/features/warehouse-map/types";

/** Bề dày mặt tầng và cột kệ (m) — chỉ để vẽ. */
const BOARD = 0.05;
const POST = 0.08;

/**
 * Một kệ 3D: 4 cột, mặt tầng theo cao độ (`elevation`), bin trên tầng tô theo `effectiveStatus`;
 * bin không dùng được mờ đi. Khung cục bộ xoay như 2D (`shelfTransform`), trục y lên trên.
 */
export function Shelf3D({
  shelf,
  selected,
  color,
  onSelect,
}: {
  shelf: LayoutShelf;
  selected: boolean;
  color: (cssVar: string) => string;
  onSelect: () => void;
}) {
  const { tx, ty, deg } = shelfTransform(shelf.footprint);
  const { width: sw, length: sl } = shelf.footprint;
  const top = shelfHeight(shelf);
  const frame = color(selected ? "--dot-info" : "--ink-secondary");
  const inactive = shelf.status === LOCATION_STATUS.INACTIVE;
  return (
    <group
      position={[tx, 0, ty]}
      rotation={[0, (-deg * Math.PI) / 180, 0]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {[
        [0, 0],
        [sw, 0],
        [0, sl],
        [sw, sl],
      ].map(([x = 0, z = 0]) => (
        <mesh key={`${x}-${z}`} position={[x, top / 2, z]}>
          <boxGeometry args={[POST, top, POST]} />
          <meshStandardMaterial color={frame} />
        </mesh>
      ))}
      {shelf.levels.map((level) => {
        const { bottom, height } = levelSpan(level);
        return (
          <group key={level.id} position={[0, bottom, 0]}>
            <mesh position={[sw / 2, BOARD / 2, sl / 2]}>
              <boxGeometry args={[sw, BOARD, sl]} />
              <meshStandardMaterial color={frame} transparent opacity={inactive ? 0.3 : 0.8} />
            </mesh>
            {level.bins.map((bin) => {
              const f = bin.footprint;
              const binHeight = height * 0.6;
              return (
                <mesh
                  key={bin.id}
                  position={[f.x + f.width / 2, BOARD + binHeight / 2, f.y + f.length / 2]}
                >
                  <boxGeometry args={[f.width * 0.92, binHeight, f.length * 0.85]} />
                  <meshStandardMaterial
                    color={color(TONE_VAR[locationTone(bin.effectiveStatus)])}
                    transparent
                    opacity={bin.usable ? 0.85 : 0.35}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
      <Html position={[sw / 2, top + 0.3, sl / 2]} center distanceFactor={span(sw, sl)}>
        <span className="bg-bg-surface text-ink-primary border-border-default pointer-events-none rounded-(--r-sm) border px-1 font-[family-name:var(--font-mono)] text-xs whitespace-nowrap">
          {shelf.code}
        </span>
      </Html>
    </group>
  );
}

/** Nhãn mã kệ co theo cỡ kệ để kệ nhỏ không bị chữ che kín. */
const span = (w: number, l: number) => Math.max(8, Math.min(20, Math.max(w, l) * 1.5));
