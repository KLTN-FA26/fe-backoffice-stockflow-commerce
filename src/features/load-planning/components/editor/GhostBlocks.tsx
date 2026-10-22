"use client";

import { Edges } from "@react-three/drei";
import { useState } from "react";

import { SCENE_COLORS } from "@/constants";

import type { ThreeEvent } from "@react-three/fiber";
import type { SceneBlock } from "../../lib/scene";

/**
 * Ô xanh gợi ý chỗ đặt (đã trọng lực + hợp lệ): bấm một ô để đặt kiện đang chọn ở khay. Tối đa `landingGhostsMax`
 * ô nên mỗi ô là một mesh riêng cũng nhẹ; bấm không xuyên xuống kiện phía sau.
 */
export function GhostBlocks({
  blocks,
  onPlace,
}: {
  blocks: readonly SceneBlock[];
  onPlace: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <>
      {blocks.map((block) => (
        <mesh
          key={block.id}
          position={block.position}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            onPlace(block.id);
          }}
          onPointerOver={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            setHovered(block.id);
          }}
          onPointerOut={() => setHovered((current) => (current === block.id ? null : current))}
        >
          <boxGeometry args={block.size} />
          <meshStandardMaterial
            color={SCENE_COLORS.landing}
            transparent
            opacity={hovered === block.id ? 0.7 : 0.38}
            depthWrite={false}
          />
          <Edges color={SCENE_COLORS.landingEdge} />
        </mesh>
      ))}
    </>
  );
}
