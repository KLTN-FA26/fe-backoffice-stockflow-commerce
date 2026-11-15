"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { cameraPositionFor } from "./camera-views";

import type { Vector3 } from "three";
import type { Framing, Vec3 } from "./camera-views";

/** A request to turn the view; a new `nonce` turns it again even to the same side after the person rotated away. */
export interface TurnRequest {
  direction: Vec3;
  nonce: number;
}

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

function isOrbitLike(value: unknown): value is OrbitLike {
  return typeof value === "object" && value !== null && "target" in value && "update" in value;
}

/** Puts the camera on the requested side of the model, at the framing distance, looking at its centre. */
export function CameraRig({ framing, request }: { framing: Framing; request: TurnRequest | null }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  useEffect(() => {
    if (!request) return;
    const [x, y, z] = cameraPositionFor(framing, request.direction);
    camera.position.set(x, y, z);
    camera.lookAt(...framing.centre);
    if (isOrbitLike(controls)) {
      controls.target.set(...framing.centre);
      controls.update();
    }
  }, [request, framing, camera, controls]);
  return null;
}
