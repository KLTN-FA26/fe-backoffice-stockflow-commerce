"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Color, Euler, Matrix4, Quaternion, Vector3 } from "three";

import type { ThreeEvent } from "@react-three/fiber";
import type { BufferGeometry, InstancedMesh, Material } from "three";

const UNIT = [1, 1, 1] as const;

/** Một hộp: tâm, cỡ, góc [quanh trục dọc, nghiêng quanh trục X cục bộ] — Euler "YXZ". */
export interface BoxPart {
  position: [number, number, number];
  size: [number, number, number];
  rotation: [number, number];
}

/**
 * Nhiều hộp cùng vật liệu = MỘT `InstancedMesh` tĩnh: ma trận + màu ghi một lần khi dữ liệu đổi, không
 * tính lại mỗi khung hình (khác `<Instances>` của drei — cập nhật mọi instance mỗi frame, nguyên nhân
 * cảnh giật khi xoay). Bấm / trỏ trả về chỉ số instance.
 */
export function PartsMesh({
  parts,
  colors,
  color = "white",
  roughness,
  metalness,
  castShadow = true,
  materials,
  geometry,
  baseSize = UNIT,
  onPick,
  onHover,
}: {
  parts: readonly BoxPart[];
  /** Màu theo từng instance (cùng thứ tự `parts`); không có thì dùng `color`. */
  colors?: readonly string[];
  color?: string;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  /** Vật liệu riêng (có texture / shader) hoặc riêng từng mặt hộp — thay vật liệu một màu `color` / `roughness`. */
  materials?: Material | Material[];
  /** Hình riêng thay hộp đơn vị (pallet có nan, beam bo cạnh) — chung cho mọi instance. */
  geometry?: BufferGeometry;
  /** Cỡ thật của `geometry` theo 3 trục: instance co theo `size / baseSize` (mặc định hình đơn vị 1 × 1 × 1). */
  baseSize?: readonly [number, number, number];
  onPick?: (index: number) => void;
  onHover?: (index: number | null) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const [matrix, rotation, quaternion] = [
      new Matrix4(),
      new Euler(0, 0, 0, "YXZ"),
      new Quaternion(),
    ];
    const [position, scale, tint] = [new Vector3(), new Vector3(), new Color()];
    parts.forEach((part, index) => {
      rotation.set(part.rotation[1], part.rotation[0], 0, "YXZ");
      quaternion.setFromEuler(rotation);
      position.set(...part.position);
      scale.set(part.size[0] / baseSize[0], part.size[1] / baseSize[1], part.size[2] / baseSize[2]);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      const instanceColor = colors?.[index];
      if (instanceColor) mesh.setColorAt(index, tint.set(instanceColor));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [parts, colors, baseSize, invalidate]);

  const interactive = Boolean(onPick ?? onHover);
  const indexOf = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    event.stopPropagation();
    return event.instanceId ?? null;
  };
  return (
    // key theo số instance: buffer cấp cố định lúc tạo → đổi số lượng thì dựng mesh mới
    <instancedMesh
      key={parts.length}
      ref={ref}
      args={[undefined, undefined, parts.length]}
      castShadow={castShadow}
      receiveShadow
      {...(materials ? { material: materials } : {})}
      {...(geometry ? { geometry } : {})}
      // Không bắt chuột (thùng carton…) → bỏ raycast, trỏ / bấm xuyên qua tới kệ
      {...(interactive ? {} : { raycast: () => null })}
      onClick={(event) => {
        const index = indexOf(event);
        if (index !== null) onPick?.(index);
      }}
      onPointerMove={(event) => onHover?.(indexOf(event))}
      onPointerOut={() => onHover?.(null)}
    >
      {!geometry && <boxGeometry />}
      {!materials && (
        <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
      )}
    </instancedMesh>
  );
}
