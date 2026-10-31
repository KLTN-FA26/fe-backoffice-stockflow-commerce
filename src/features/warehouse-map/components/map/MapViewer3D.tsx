"use client";

import dynamic from "next/dynamic";
import { Component, useSyncExternalStore } from "react";

import { UI_LABELS } from "@/constants";

import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import { MapCanvas2D } from "./MapCanvas2D";

import type { ReactNode } from "react";
import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapControlsProps } from "../shared/MapControls";

const M = UI_LABELS.warehouseMap.map;
/** Cảnh 3D lấp kín khung bản đồ (khung cao theo trang / toàn màn hình). */
const HEIGHT = "h-full min-h-[20rem]";

/** three + react-three-fiber nặng: tách chunk, chỉ tải khi bật 3D, không chạy trên server. */
const MapScene3D = dynamic(() => import("./MapScene3D"), {
  ssr: false,
  loading: () => <Skeleton role="status" aria-label={M.loading3d} className={`w-full ${HEIGHT}`} />,
});

let webGlSupport: boolean | undefined;

/**
 * Kiểm WebGL MỘT lần rồi nhớ kết quả, và trả context thử ngay. `useSyncExternalStore` gọi hàm này mỗi
 * lần render (dev: hai lần) — trước đây mỗi lần tạo một WebGL context mới; trình duyệt chỉ giữ ~16
 * context nên huỷ context CŨ NHẤT = context của cảnh 3D → mở / đóng modal vài lần là cảnh trống trơn.
 */
function detectWebGl(): boolean {
  if (webGlSupport !== undefined) return webGlSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    webGlSupport = gl !== null;
  } catch {
    webGlSupport = false;
  }
  return webGlSupport;
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
  /** Mở modal chi tiết vị trí đang xem (3D chọn kệ = bay camera tới, không tự mở modal). */
  onOpenDetail: () => void;
  controls: Omit<MapControlsProps, "zoom">;
}

/** Cổng vào 3D: không có WebGL hoặc cảnh lỗi → nhãn giải thích + bản đồ 2D cùng dữ liệu. */
export function MapViewer3D({ controls, onOpenDetail, ...props }: MapViewerProps) {
  // Chỉ kiểm WebGL ở client; server render coi như có để không lệch hydration
  const webGl = useSyncExternalStore(noop, detectWebGl, () => true);
  const fallback = (
    <div className="flex h-full flex-col gap-2">
      <Alert tone="warning">{M.webglFallback}</Alert>
      <div className="min-h-0 flex-1">
        <MapCanvas2D {...props} controls={controls} />
      </div>
    </div>
  );
  if (!webGl) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      {/* Thanh điều khiển nổi nằm trong cảnh: lại gần / ra xa / toàn cảnh điều khiển camera 3D */}
      <div className={HEIGHT}>
        <MapScene3D {...props} onOpenDetail={onOpenDetail} controls={controls} />
      </div>
    </SceneBoundary>
  );
}
