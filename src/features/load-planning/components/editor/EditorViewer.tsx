"use client";

import dynamic from "next/dynamic";

import { LOAD_PLANNING_LABELS, LOAD_PLANNING_LIMITS } from "@/constants";

import { Skeleton } from "@/components/shared/Skeleton";

/** Cổng vào của khung 3D trình soạn: tách chunk three, không chạy trên server (như `VehicleViewer`). */
export const EditorViewer = dynamic(
  () => import("./EditorViewport").then((module) => module.EditorViewport),
  {
    ssr: false,
    loading: () => (
      <Skeleton
        role="status"
        aria-label={LOAD_PLANNING_LABELS.viewer.loading}
        className="w-full"
        style={{ height: LOAD_PLANNING_LIMITS.editorViewerHeightPx }}
      />
    ),
  },
);
