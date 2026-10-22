"use client";

import { Edges, Html } from "@react-three/drei";
import { useState } from "react";

import { SCENE_COLORS } from "@/constants";

import type { ThreeEvent } from "@react-three/fiber";
import type { SceneBlock } from "../../lib/scene";

/** Khối gia cố ở góc trên xe: nửa trong suốt, không tương tác. */
export function GussetBlocks({ blocks }: { blocks: readonly SceneBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <mesh key={block.id} position={block.position}>
          <boxGeometry args={block.size} />
          <meshStandardMaterial
            color={SCENE_COLORS.gusset}
            roughness={0.7}
            metalness={0.2}
            transparent
            opacity={0.55}
          />
          <Edges color={SCENE_COLORS.gussetEdge} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Lớp phủ "xem chỗ trống": khối cyan trong suốt cho từng khoảng trống, rê chuột để xem kích thước.
 * Người gọi ẩn hàng để chỉ còn các khoảng trống (nền sạch để phân tích).
 */
export function EmptySpaceBlocks({ blocks }: { blocks: readonly SceneBlock[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <>
      {blocks.map((block) => (
        <mesh
          key={block.id}
          position={block.position}
          onPointerOver={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            setHovered(block.id);
          }}
          onPointerOut={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            setHovered((current) => (current === block.id ? null : current));
          }}
        >
          <boxGeometry args={block.size} />
          <meshStandardMaterial
            color={SCENE_COLORS.emptySpace}
            roughness={0.5}
            metalness={0.05}
            transparent
            opacity={hovered === block.id ? 0.62 : 0.4}
            depthWrite={false}
          />
          <Edges color={SCENE_COLORS.emptySpaceEdge} />
          {hovered === block.id && block.label && (
            <Html
              center
              zIndexRange={[20, 0]}
              style={{ pointerEvents: "none" }}
              position={[0, block.size[1] / 2 + 0.4, 0]}
            >
              <div className="bg-info/95 text-ink-inverse pointer-events-none rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-md">
                {block.label}
              </div>
            </Html>
          )}
        </mesh>
      ))}
    </>
  );
}
