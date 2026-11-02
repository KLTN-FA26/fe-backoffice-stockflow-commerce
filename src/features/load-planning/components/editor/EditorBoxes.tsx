"use client";

import { Html } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, Matrix4, Quaternion, Vector3 } from "three";

import { SCENE_COLORS } from "@/constants";

import { boxEdgePositions, toneColor } from "../../lib/editor-scene";

import { useEdgeGeometry } from "./use-edge-geometry";

import type { ThreeEvent } from "@react-three/fiber";
import type { InstancedMesh } from "three";
import type { BoxTone, EditorSceneBox } from "../../lib/editor-scene";

const IDENTITY = new Quaternion();

/**
 * Mọi kiện của xe bằng MỘT `InstancedMesh` (màu riêng từng kiện) + MỘT `LineSegments` cho viền: 2 lệnh vẽ dù xe có
 * 600 hay 2000 kiện (viewer xem vẽ mỗi kiện hai lệnh nên cắt ở 600). Chọn kiện qua `instanceId` của tia chiếu.
 * `key` theo số kiện: R3F dựng lại `InstancedMesh` (và giải phóng cái cũ) khi số instance đổi, vì sức chứa cố định.
 */
export function EditorBoxes({
  boxes,
  tones,
  onPick,
}: {
  boxes: readonly EditorSceneBox[];
  /** Trạng thái tô màu theo `ref` (mặc định "idle"). */
  tones: ReadonlyMap<string, BoxTone>;
  onPick: (ref: string, additive: boolean) => void;
}) {
  const mesh = useRef<InstancedMesh>(null);
  // Theo `ref` (không theo chỉ số): kiện đổi chỗ / bị gỡ thì con trỏ treo tự hết, không cần effect dọn.
  const [hovered, setHovered] = useState<string | null>(null);
  const edges = useEdgeGeometry(useMemo(() => boxEdgePositions(boxes), [boxes]));

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    boxes.forEach((box, index) => {
      matrix.compose(new Vector3(...box.position), IDENTITY, new Vector3(...box.size));
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    // Tia chiếu dùng hình cầu bao của cả lô: phải tính lại khi vị trí đổi, nếu không kiện mới nhích ra ngoài bị bỏ sót.
    target.computeBoundingSphere();
  }, [boxes]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const color = new Color();
    boxes.forEach((box, index) => {
      const tone =
        hovered === box.ref && !tones.has(box.ref) ? "hover" : (tones.get(box.ref) ?? "idle");
      target.setColorAt(index, color.set(toneColor(box.baseColor, tone)));
    });
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [boxes, tones, hovered]);

  if (boxes.length === 0) return null;
  const hoveredBox = hovered === null ? undefined : boxes.find((box) => box.ref === hovered);
  const pointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(event.instanceId === undefined ? null : (boxes[event.instanceId]?.ref ?? null));
  };
  return (
    <>
      <instancedMesh
        key={boxes.length}
        ref={mesh}
        args={[undefined, undefined, boxes.length]}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          const box = event.instanceId === undefined ? undefined : boxes[event.instanceId];
          if (box) onPick(box.ref, event.nativeEvent.shiftKey);
        }}
        onPointerMove={pointer}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(null);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.55}
          metalness={0.05}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </instancedMesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={SCENE_COLORS.boxEdge} />
      </lineSegments>
      {hoveredBox && (
        <Html
          position={hoveredBox.position}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-ink-primary/90 text-ink-inverse pointer-events-none rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shadow-md">
            {hoveredBox.label}
          </div>
        </Html>
      )}
    </>
  );
}
