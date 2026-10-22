"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";

import { LOAD_PLANNING_LIMITS, UI_LABELS } from "@/constants";

import { buildEditorBoxes } from "../../lib/editor-scene";
import { extentOf, formatLWH } from "../../lib/dims";
import { blockToScene, sceneScale } from "../../lib/scene";
import { CameraPreset } from "../viewer/CameraPreset";
import { EmptySpaceBlocks, GussetBlocks } from "../viewer/SpaceBlocks";
import { useSceneTheme } from "../viewer/useSceneTheme";
import { VehicleShell } from "../viewer/VehicleShell";
import { ViewButtons } from "../viewer/ViewButtons";

import { EditorBoxes } from "./EditorBoxes";
import { GhostBlocks } from "./GhostBlocks";

import type { ViewKind } from "@/constants";
import type { LandingGhost, Space } from "../../lib/empty-spaces";
import type { BoxTone } from "../../lib/editor-scene";
import type { ColorMap } from "../../lib/palette";
import type { EditVehicle } from "../../editor/types";
import type { ViewRequest } from "../viewer/CameraPreset";

export interface EditorViewportProps {
  vehicle: EditVehicle;
  colorMap: ColorMap;
  tones: ReadonlyMap<string, BoxTone>;
  ghosts: readonly LandingGhost[];
  /** Khác null = đang xem chỗ trống: ẩn hàng, chỉ vẽ các khoảng trống lớn nhất. */
  emptySpaces: readonly Space[] | null;
  onBoxPick: (ref: string, additive: boolean) => void;
  onGhostPlace: (id: string) => void;
  onBackgroundClick: () => void;
}

const E = UI_LABELS.loadPlan.editor;
const SHRINK = 0.99;

/** Khung 3D của trình soạn xếp tay (react-three-fiber). Nặng (three) nên chỉ nạp qua `EditorViewer` (next/dynamic). */
export function EditorViewport({
  vehicle,
  colorMap,
  tones,
  ghosts,
  emptySpaces,
  onBoxPick,
  onGhostPlace,
  onBackgroundClick,
}: EditorViewportProps) {
  const theme = useSceneTheme();
  const [view, setView] = useState<ViewRequest | null>(null);
  const extent = useMemo(() => extentOf(vehicle.innerMm), [vehicle.innerMm]);
  const scale = sceneScale(extent);
  const boxes = useMemo(
    () => buildEditorBoxes(vehicle.boxes, extent, scale, colorMap),
    [vehicle.boxes, extent, scale, colorMap],
  );
  const gussets = useMemo(
    () => vehicle.gussets.map((g, i) => ({ id: `gusset-${i}`, ...blockToScene(g, extent, scale) })),
    [vehicle.gussets, extent, scale],
  );
  const ghostBlocks = useMemo(
    () => ghosts.map((g) => ({ id: g.id, ...blockToScene(g, extent, scale, SHRINK) })),
    [ghosts, extent, scale],
  );
  const emptyBlocks = useMemo(
    () =>
      (emptySpaces ?? []).map((s) => ({
        id: s.id,
        label: formatLWH(s),
        ...blockToScene(s, extent, scale, SHRINK),
      })),
    [emptySpaces, extent, scale],
  );
  const [width, height, depth] = [extent.wMm * scale, extent.hMm * scale, extent.dMm * scale];
  const distance = Math.max(width, height, depth) * 1.35;
  const requestView = (kind: ViewKind) =>
    setView((current) => ({ kind, nonce: (current?.nonce ?? 0) + 1 }));

  return (
    <div
      role="group"
      aria-label={E.viewport.aria(vehicle.code)}
      className="border-border-default bg-bg-subtle relative w-full overflow-hidden border"
      style={{ height: LOAD_PLANNING_LIMITS.editorViewerHeightPx }}
    >
      <ViewButtons onSelect={requestView} />
      <Canvas
        camera={{ position: [distance, distance * 0.75, distance], fov: 38 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        style={{ height: "100%", width: "100%" }}
        onPointerMissed={onBackgroundClick}
      >
        <color attach="background" args={[theme.background]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[8, 10, 6]} intensity={1.1} />
        <directionalLight position={[-8, 4, -6]} intensity={0.35} />
        <VehicleShell width={width} height={height} depth={depth} theme={theme} />
        {emptySpaces === null ? (
          <EditorBoxes boxes={boxes} tones={tones} onPick={onBoxPick} />
        ) : (
          <EmptySpaceBlocks blocks={emptyBlocks} />
        )}
        <GussetBlocks blocks={gussets} />
        <GhostBlocks blocks={ghostBlocks} onPlace={onGhostPlace} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxDistance={distance * 3}
          minDistance={distance * 0.35}
        />
        <CameraPreset request={view} distance={distance} sceneHeight={height} />
      </Canvas>
    </div>
  );
}
