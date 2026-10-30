"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { BOUNDARY_TYPE, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { boxOf } from "@/features/warehouse-map/selectors";

import { Shelf3D } from "./Shelf3D";
import { locationTone, TONE_VAR } from "./tone";
import { useCssColor } from "./use-css-color";

import type { ThreeEvent } from "@react-three/fiber";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/** Bề dày tường / cửa vẽ 3D (m) — BE không lưu bề dày, chỉ để nhìn thấy. */
const WALL = 0.08;

/**
 * Cảnh 3D — dựng lại từ CÙNG dữ liệu bố cục với 2D (docs 06 §1): trục x = x bản đồ, trục z = y bản đồ,
 * trục y = cao độ tầng. Bin tô theo `effectiveStatus`. Chỉ trực quan (BR-05). Nạp lười qua `next/dynamic`.
 */
export default function MapScene3D({
  layout,
  selectedId,
  onSelect,
}: {
  layout: WarehouseLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const color = useCssColor();
  const { mapWidth: w, mapHeight: h } = layout.warehouse;
  const span = Math.max(w, h);
  return (
    <Canvas
      camera={{
        position: [w / 2, span * 0.75, h + span * 0.45],
        fov: 45,
        near: 0.1,
        far: span * 10,
      }}
      onPointerMissed={() => onSelect(null)}
      className="bg-bg-subtle rounded-(--card-radius)"
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[w, span, h]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, h / 2]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={color("--bg-surface")} />
      </mesh>
      {layout.areas.map((area) => {
        const b = boxOf(area.footprint);
        return (
          <mesh
            key={area.id}
            position={[b.x + b.w / 2, 0.01, b.y + b.h / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onSelect(area.id);
            }}
          >
            <planeGeometry args={[b.w, b.h]} />
            <meshStandardMaterial
              color={color(TONE_VAR[locationTone(area.effectiveStatus)])}
              transparent
              opacity={area.id === selectedId ? 0.55 : 0.25}
            />
          </mesh>
        );
      })}
      {layout.shelves.map((shelf) => (
        <Shelf3D
          key={shelf.id}
          shelf={shelf}
          selected={shelf.id === selectedId}
          color={color}
          onSelect={() => onSelect(shelf.id)}
        />
      ))}
      {layout.boundaries.map((boundary) => {
        const dx = boundary.endX - boundary.startX;
        const dz = boundary.endY - boundary.startY;
        const door = boundary.type === BOUNDARY_TYPE.DOOR;
        const height = door ? LIMITS.wallHeight3d * 0.7 : LIMITS.wallHeight3d;
        return (
          <mesh
            key={boundary.id}
            position={[boundary.startX + dx / 2, height / 2, boundary.startY + dz / 2]}
            rotation={[0, -Math.atan2(dz, dx), 0]}
          >
            <boxGeometry args={[Math.hypot(dx, dz), height, WALL]} />
            <meshStandardMaterial
              color={color(door ? "--dot-info" : "--ink-tertiary")}
              transparent={door}
              opacity={door ? 0.35 : 1}
            />
          </mesh>
        );
      })}
      <OrbitControls target={[w / 2, 0, h / 2]} maxPolarAngle={Math.PI / 2.05} makeDefault />
    </Canvas>
  );
}
