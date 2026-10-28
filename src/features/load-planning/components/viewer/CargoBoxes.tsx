"use client";

import { Edges, Html } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";

import { SCENE_COLORS } from "@/constants";

import { disposeLabelMaterials, makeLabelMaterial } from "./label-material";

import type { ThreeEvent } from "@react-three/fiber";
import type { SpriteMaterial } from "three";
import type { SceneBox } from "../../lib/scene";

/** Chỉ in nhãn lên mặt thùng đủ rộng để đọc (đơn vị thế giới). */
const MIN_LABEL_FOOTPRINT = 0.12;
const OPACITY = { hovered: 0.95, otherHovered: 0.55, idle: 0.9 } as const;

/** Một vật liệu nhãn cho mỗi mã duy nhất (mã lặp ở nhiều thùng). Giải phóng khi mã đổi/unmount. */
function useLabelMaterials(
  boxes: readonly SceneBox[],
  enabled: boolean,
): ReadonlyMap<string, SpriteMaterial> {
  const materials = useMemo(() => {
    const map = new Map<string, SpriteMaterial>();
    if (!enabled) return map;
    for (const box of boxes) {
      if (box.code && !map.has(box.code)) map.set(box.code, makeLabelMaterial(box.code));
    }
    return map;
  }, [boxes, enabled]);
  useEffect(() => () => disposeLabelMaterials(materials.values()), [materials]);
  return materials;
}

export function CargoBoxes({
  boxes,
  showLabels,
}: {
  boxes: readonly SceneBox[];
  showLabels: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const labelMaterials = useLabelMaterials(boxes, showLabels);

  return (
    <>
      {boxes.map((item) => {
        const footprint = Math.min(item.size[0], item.size[2]);
        const labelMaterial = labelMaterials.get(item.code);
        return (
          <mesh
            key={item.id}
            position={item.position}
            onPointerOver={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              setHovered(item.id);
            }}
            onPointerOut={(event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              setHovered((current) => (current === item.id ? null : current));
            }}
          >
            <boxGeometry args={item.size} />
            <meshStandardMaterial
              color={item.color}
              roughness={0.55}
              metalness={0.05}
              transparent
              opacity={
                hovered === item.id
                  ? OPACITY.hovered
                  : hovered
                    ? OPACITY.otherHovered
                    : OPACITY.idle
              }
            />
            <Edges color={SCENE_COLORS.boxEdge} />
            {labelMaterial && footprint > MIN_LABEL_FOOTPRINT && (
              <sprite
                material={labelMaterial}
                position={[0, item.size[1] / 2 + footprint * 0.2, 0]}
                scale={[Math.min(footprint * 0.95, 2), Math.min(footprint * 0.95, 2) * 0.5, 1]}
              />
            )}
            {hovered === item.id && (
              // Không dùng distanceFactor: giữ tooltip cỡ không đổi trên màn hình (có nó thì camera
              // lùi xa làm tooltip phình thành mảng trắng). pointerEvents none cả ở lớp bọc, nếu
              // không tooltip nằm dưới con trỏ sẽ nuốt cú bấm định gửi cho thùng.
              <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <div className="bg-ink-primary/90 text-ink-inverse pointer-events-none rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-md">
                  {item.label}
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </>
  );
}
