"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { cameraPosition } from "../../lib/view-presets";

import type { ViewKind } from "@/constants";
import type { Vector3 } from "three";

export interface ViewRequest {
  kind: ViewKind;
  /** Tăng mỗi lần bấm — bấm lại cùng góc vẫn đưa camera về nhà sau khi người dùng xoay đi. */
  nonce: number;
}

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

function isOrbitLike(value: unknown): value is OrbitLike {
  return typeof value === "object" && value !== null && "target" in value && "update" in value;
}

/** Áp góc nhìn nhanh mỗi khi `request.nonce` đổi. Nằm trong `<Canvas>` vì cần `useThree`. */
export function CameraPreset({
  request,
  distance,
  sceneHeight,
}: {
  request: ViewRequest | null;
  distance: number;
  sceneHeight: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  useEffect(() => {
    if (!request) return;
    const [x, y, z] = cameraPosition(request.kind, distance, sceneHeight);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    if (isOrbitLike(controls)) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    // Chỉ chạy khi có yêu cầu mới: khoảng cách/chiều cao đổi do tải xe khác không được giật camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  return null;
}
