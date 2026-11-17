"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { MODEL3D_VIEW as VIEW } from "@/constants/numbers";

import { CameraRig } from "./CameraRig";
import { startPosition } from "./camera-views";

import type { Object3D } from "three";
import type { Framing } from "./camera-views";
import type { TurnRequest } from "./CameraRig";
import type { PrintView } from "./print-view";

/**
 * The scene: the loaded tree as it is, the grid meshes beside it, light, and the camera on the front of the product.
 * The tree is drawn as a `primitive`: react-three-fiber does not free it (the reading hook does), and the grid
 * meshes are freed by `undoPrintView`.
 */
export function PrintModelCanvas({
  root,
  view,
  framing,
  request,
  onLost,
}: {
  root: Object3D;
  view: PrintView | null;
  framing: Framing;
  request: TurnRequest | null;
  /** The browser took the WebGL context away: the caller replaces the canvas with a message. */
  onLost: () => void;
}) {
  const { centre, radius, distance } = framing;
  return (
    <Canvas
      camera={{
        position: startPosition(framing),
        fov: VIEW.fovDeg,
        near: radius / VIEW.nearDivisor,
        far: distance * VIEW.farFactor,
      }}
      dpr={[VIEW.pixelRatioMin, VIEW.pixelRatioMax]}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        // The caller unmounts the canvas when this fires, which frees the element and its listener with it.
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onLost();
        });
      }}
      style={{ height: "100%", width: "100%" }}
    >
      <ambientLight intensity={VIEW.ambientIntensity} />
      <directionalLight
        position={[...VIEW.keyLight.position]}
        intensity={VIEW.keyLight.intensity}
      />
      <directionalLight
        position={[...VIEW.fillLight.position]}
        intensity={VIEW.fillLight.intensity}
      />
      <primitive object={root} />
      {view && <primitive object={view.group} />}
      <OrbitControls
        makeDefault
        enableDamping
        target={centre}
        minDistance={distance * VIEW.minDistanceFactor}
        maxDistance={distance * VIEW.maxDistanceFactor}
      />
      <CameraRig framing={framing} request={request} />
    </Canvas>
  );
}
