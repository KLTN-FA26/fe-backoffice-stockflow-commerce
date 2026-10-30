"use client";

import dynamic from "next/dynamic";
import { Component, useSyncExternalStore } from "react";

import { UI_LABELS } from "@/constants";

import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import { MapCanvas2D } from "./MapCanvas2D";

import type { ReactNode } from "react";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

const M = UI_LABELS.warehouseMap.map;
const HEIGHT = "h-[calc(100vh-15rem)] min-h-[24rem]";

/** three + react-three-fiber nặng: tách chunk, chỉ tải khi bật 3D, không chạy trên server. */
const MapScene3D = dynamic(() => import("./MapScene3D"), {
  ssr: false,
  loading: () => <Skeleton role="status" aria-label={M.loading3d} className={`w-full ${HEIGHT}`} />,
});

function detectWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const noop = () => () => {};

/** Lỗi khi dựng cảnh (model / driver) → rơi về bản đồ 2D thay vì trắng trang (mode-b §fallback). */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface MapViewerProps {
  layout: WarehouseLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Cổng vào 3D: không có WebGL hoặc cảnh lỗi → nhãn giải thích + bản đồ 2D cùng dữ liệu. */
export function MapViewer3D(props: MapViewerProps) {
  // Chỉ kiểm WebGL ở client; server render coi như có để không lệch hydration
  const webGl = useSyncExternalStore(noop, detectWebGl, () => true);
  const fallback = (
    <div className="space-y-2">
      <Alert tone="warning">{M.webglFallback}</Alert>
      <MapCanvas2D {...props} />
    </div>
  );
  if (!webGl) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <div className={HEIGHT}>
        <MapScene3D {...props} />
      </div>
    </SceneBoundary>
  );
}
