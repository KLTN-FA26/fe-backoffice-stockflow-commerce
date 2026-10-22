"use client";

import { useMemo, useState } from "react";

import { isOptimisticLockError, loadPlanErrorMessage } from "../errors";
import { useSavePlacements } from "../mutations";
import { useLoadPlan, useLoadPlanLayouts } from "../queries";

import { buildEditorState } from "./build-state";
import { diffEditorStates } from "./diff";
import { isPlacementViolation, serverIssuesOf } from "./issues";
import { buildPlacementsPayload } from "./payload";

import type { StateDiff } from "./diff";
import type { DoorsByType } from "./build-state";
import type { ServerIssue } from "./issues";
import type { EditorState } from "./types";

export interface SaveFlowInput {
  loadPlanId: string;
  /** `version` của kế hoạch lúc mở trình soạn — lưu gửi đúng số này để 409 phát hiện người khác đã sửa. */
  openedVersion: number;
  state: EditorState;
  baseline: EditorState;
  doors: DoorsByType;
  /** Thay bản đang soạn bằng bản máy chủ ("Tải lại"). */
  onReload: (next: EditorState) => void;
  onSaved: () => void;
}

/** `lock`: 409 OPTIMISTIC_LOCK (có thể ghi đè sau khi xem); `stale`: dữ liệu đã cũ theo cách khác (chỉ tải lại). */
export type ConflictKind = "lock" | "stale";

/**
 * Lưu bố cục và các nhánh lỗi, luôn GIỮ bản đang soạn: 422 → vi phạm theo kiện (tô đỏ), 409 OPTIMISTIC_LOCK → hỏi "Tải
 * lại" hay "Ghi đè sau khi xem" (so bản mới với bản lúc mở), lỗi khác → báo và cho thử lại.
 */
export function useSaveFlow(input: SaveFlowInput) {
  const { loadPlanId, state, baseline, doors } = input;
  const mutation = useSavePlacements();
  const latestPlan = useLoadPlan(loadPlanId).data;
  const latestLayouts = useLoadPlanLayouts(loadPlanId, true);
  const [version, setVersion] = useState(input.openedVersion);
  const [serverIssues, setServerIssues] = useState<readonly ServerIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ kind: ConflictKind; message: string } | null>(null);

  const serverState = useMemo(
    () =>
      conflict && latestPlan && latestPlan.version !== version && latestLayouts.data
        ? buildEditorState(latestPlan, latestLayouts.data, doors)
        : null,
    [conflict, latestPlan, latestLayouts.data, version, doors],
  );
  const diff: StateDiff | null = useMemo(
    () => (serverState ? diffEditorStates(baseline, serverState) : null),
    [serverState, baseline],
  );

  const send = (expectedVersion: number) => {
    const sent = state;
    setError(null);
    mutation.mutate(
      { loadPlanId, payload: buildPlacementsPayload(sent, expectedVersion) },
      {
        onSuccess: input.onSaved,
        onError: (e) => {
          if (isPlacementViolation(e)) setServerIssues(serverIssuesOf(e, sent));
          else if (isOptimisticLockError(e))
            setConflict({ kind: "lock", message: loadPlanErrorMessage(e) });
          else if (e.status === 409 || e.status === 404)
            setConflict({ kind: "stale", message: loadPlanErrorMessage(e) });
          else setError(loadPlanErrorMessage(e));
        },
      },
    );
  };

  const clear = () => {
    setConflict(null);
    setServerIssues([]);
    setError(null);
  };

  return {
    saving: mutation.isPending,
    serverIssues,
    error,
    conflict,
    diff,
    /** Bản máy chủ mới đã sẵn sàng để tải lại / so sánh. */
    serverReady: serverState !== null,
    save: () => send(version),
    overwrite: () => latestPlan && diff?.canOverwrite && send(latestPlan.version),
    reload: () => {
      if (!serverState || !latestPlan) return;
      input.onReload(serverState);
      setVersion(latestPlan.version);
      clear();
    },
  };
}
