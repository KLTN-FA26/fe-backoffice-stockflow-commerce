"use client";

import dynamic from "next/dynamic";

import { LOAD_PLANNING_LABELS } from "@/constants";

import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Cổng vào công khai của khung 3D: three + react-three-fiber nặng nên tách chunk, chỉ tải khi
 * trang cần xem xe, và không chạy trên server (WebGL/`document`). Đừng import `VehicleViewer3D`
 * trực tiếp — nó kéo cả three vào bundle của trang.
 */
export const VehicleViewer = dynamic(
  () => import("./VehicleViewer3D").then((module) => module.VehicleViewer3D),
  {
    ssr: false,
    loading: () => (
      <Skeleton
        role="status"
        aria-label={LOAD_PLANNING_LABELS.viewer.loading}
        className="h-[360px] w-full"
      />
    ),
  },
);
