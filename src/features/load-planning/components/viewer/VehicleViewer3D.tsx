"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useDeferredValue, useMemo, useState } from "react";

import { LOAD_PLANNING_LABELS, SCENE_COLORS } from "@/constants";

import { blockToScene, prepareScene } from "../../lib/scene";

import { CameraPreset } from "./CameraPreset";
import { CargoBoxes } from "./CargoBoxes";
import { EmptySpaceBlocks, GussetBlocks } from "./SpaceBlocks";
import { ViewButtons } from "./ViewButtons";

import type { ViewKind } from "@/constants";
import type { ColorMap } from "../../lib/palette";
import type { BlockMm, Layout } from "../../types";
import type { ViewRequest } from "./CameraPreset";

/** Khoảng trống để phủ lên khung 3D (mm, cùng hệ toạ độ với `Layout`). */
export type EmptySpace = BlockMm & { id: string; label?: string };

export interface VehicleViewer3DProps {
  layout: Layout;
  /** Tên mặt hàng → màu, để 3D khớp chú giải bên cạnh; mặc định tự dựng từ các kiện của xe. */
  colorMap?: ColorMap;
  /** In mã ngắn lên MỌI thùng. */
  showLabels?: boolean;
  /** Vẽ khối gia cố ở góc trên (mặc định có). */
  showGussets?: boolean;
  /** Xem chỗ trống: khối cyan trong suốt; khi có, hàng bị ẩn để chỉ còn các khoảng trống. */
  emptySpaces?: readonly EmptySpace[];
  heightPx?: number;
}

const DEFAULT_HEIGHT_PX = 360;
const EMPTY_SPACE_SHRINK = 0.99;

/**
 * Khung 3D xe + hàng (react-three-fiber). Nặng (three) nên chỉ nạp qua `VehicleViewer` (next/dynamic,
 * không SSR). R3F tự giải phóng geometry/material/renderer khi unmount; vật liệu nhãn tự tạo thì
 * được giải phóng trong `CargoBoxes`.
 */
export function VehicleViewer3D({
  layout,
  colorMap,
  showLabels = false,
  showGussets = true,
  emptySpaces,
  heightPx = DEFAULT_HEIGHT_PX,
}: VehicleViewer3DProps) {
  const [viewRequest, setViewRequest] = useState<ViewRequest | null>(null);
  const requestView = (kind: ViewKind) =>
    setViewRequest((cur) => ({ kind, nonce: (cur?.nonce ?? 0) + 1 }));

  // Hoãn việc dựng lại cảnh khi layout đổi dồn dập (kéo thả/soạn) để khung hình không giật.
  const deferredLayout = useDeferredValue(layout);
  const scene = useMemo(() => prepareScene(deferredLayout, colorMap), [deferredLayout, colorMap]);
  const emptyBlocks = useMemo(
    () =>
      (emptySpaces ?? []).map((space) => ({
        id: space.id,
        label: space.label,
        ...blockToScene(space, scene.extent, scene.scale, EMPTY_SPACE_SHRINK),
      })),
    [emptySpaces, scene.extent, scene.scale],
  );
  const showingEmpty = emptyBlocks.length > 0;
  const { cameraDistance, width, height, depth } = scene;

  return (
    <div
      role="group"
      aria-label={LOAD_PLANNING_LABELS.viewer.ariaLabel(layout.code)}
      className="border-border-default bg-bg-subtle relative w-full overflow-hidden border"
      style={{ height: heightPx, minHeight: heightPx }}
    >
      <ViewButtons onSelect={requestView} />
      {scene.truncated && (
        <p className="border-border-default bg-bg-surface/90 text-ink-secondary absolute bottom-2 left-2 z-10 rounded border px-2 py-0.5 text-[11px]">
          {LOAD_PLANNING_LABELS.viewer.truncated(scene.truncated.shown, scene.truncated.total)}
        </p>
      )}
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.75, cameraDistance], fov: 38 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ height: "100%", width: "100%" }}
      >
        <color attach="background" args={[SCENE_COLORS.background]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[8, 10, 6]} intensity={1.1} />
        <directionalLight position={[-8, 4, -6]} intensity={0.35} />

        <mesh>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial
            color={SCENE_COLORS.shellFill}
            transparent
            opacity={0.08}
            depthWrite={false}
          />
          <Edges color={SCENE_COLORS.shellEdge} />
        </mesh>
        <gridHelper
          args={[Math.max(width, depth), 12, SCENE_COLORS.gridMajor, SCENE_COLORS.gridMinor]}
          position={[0, -height / 2, 0]}
        />

        {!showingEmpty && <CargoBoxes boxes={scene.boxes} showLabels={showLabels} />}
        {showGussets && <GussetBlocks blocks={scene.gussets} />}
        {showingEmpty && <EmptySpaceBlocks blocks={emptyBlocks} />}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxDistance={cameraDistance * 3}
          minDistance={cameraDistance * 0.35}
        />
        <CameraPreset request={viewRequest} distance={cameraDistance} sceneHeight={height} />
      </Canvas>
    </div>
  );
}
