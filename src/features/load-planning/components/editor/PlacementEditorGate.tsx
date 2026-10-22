"use client";

import { useMemo, useState } from "react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import { buildEditorState } from "../../editor/build-state";
import { useActiveVehicleTypes } from "../../queries";

import { PlacementEditor } from "./PlacementEditor";

import type { DoorMm, Layout } from "../../types";
import type { PlanDetail } from "../../plan-types";
import type { EditorState } from "../../editor/types";

const E = UI_LABELS.loadPlan.editor;

/**
 * Cổng vào trình soạn: chờ kế hoạch + bố cục + loại xe (để biết cửa xe) khớp nhau rồi MỚI mở, và từ đó đóng băng bản
 * mở — dữ liệu tải lại ngầm sau đó (kể cả lúc tạm lệch phiên bản) không được gỡ hay đổi bản đang soạn.
 */
export function PlacementEditorGate({
  plan,
  layouts,
  onExit,
}: {
  plan: PlanDetail;
  layouts: readonly Layout[] | undefined;
  onExit: () => void;
}) {
  const types = useActiveVehicleTypes();
  const doors = useMemo(
    () =>
      new Map<string, DoorMm>(
        (types.data ?? []).map((type) => [
          type.vehicleTypeId,
          { widthMm: type.doorWidthMm ?? null, heightMm: type.doorHeightMm ?? null },
        ]),
      ),
    [types.data],
  );
  // Loại xe lỗi (403 thiếu quyền đọc danh mục, mạng) không chặn soạn: chỉ mất kiểm trước vế cửa, BE vẫn kiểm.
  const typesSettled = !types.isPending || types.fetchStatus === "paused";
  const built = useMemo(
    () => (layouts && typesSettled ? buildEditorState(plan, layouts, doors) : null),
    [plan, layouts, doors, typesSettled],
  );
  const [opened, setOpened] = useState<{ state: EditorState; version: number } | null>(null);
  if (!opened && built) setOpened({ state: built, version: plan.version });

  if (!opened)
    return (
      <Alert tone="info">
        <span role="status">{layouts && typesSettled ? E.notReady : E.loadingEditor}</span>
      </Alert>
    );
  return (
    <PlacementEditor
      loadPlanId={plan.loadPlanId}
      initial={opened.state}
      openedVersion={opened.version}
      doors={doors}
      onExit={onExit}
    />
  );
}
