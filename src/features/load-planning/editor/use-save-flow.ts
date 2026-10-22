"use client";

import { useMemo, useState } from "react";

import { LOAD_PLAN_STATUS } from "@/constants";

import { isOptimisticLockError, isStaleLoadPlanError, loadPlanErrorMessage } from "../errors";
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
  const planQuery = useLoadPlan(loadPlanId);
  const latestPlan = planQuery.data;
  const layoutsQuery = useLoadPlanLayouts(loadPlanId, true);
  const [version, setVersion] = useState(input.openedVersion);
  const [serverIssues, setServerIssues] = useState<readonly ServerIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    kind: ConflictKind;
    message: string;
    /** Lúc gửi lần lưu bị từ chối: chỉ dữ liệu tải về SAU đó mới là bản máy chủ hiện tại. */
    sentAt: number;
  } | null>(null);

  // Toạ độ kiện chỉ có ở `layouts` còn version ở `plan`, hai query tải lại song song: chỉ tin bản máy chủ khi CẢ HAI đã
  // tải xong sau lần lưu bị từ chối, không thì plan mới ghép với bố cục cũ sẽ cho một so sánh "không đổi gì" sai.
  const fresh = (q: { isFetching: boolean; dataUpdatedAt: number }) =>
    conflict !== null && !q.isFetching && q.dataUpdatedAt >= conflict.sentAt;
  const planFresh = fresh(planQuery);
  const layoutsFresh = fresh(layoutsQuery);
  const serverState = useMemo(
    () =>
      conflict &&
      latestPlan &&
      latestPlan.status === LOAD_PLAN_STATUS.PLANNED &&
      layoutsQuery.data &&
      planFresh &&
      layoutsFresh &&
      // 409 OPTIMISTIC_LOCK nghĩa là version máy chủ đã khác bản bạn mở
      (conflict.kind !== "lock" || latestPlan.version !== version)
        ? buildEditorState(latestPlan, layoutsQuery.data, doors)
        : null,
    [conflict, latestPlan, layoutsQuery.data, planFresh, layoutsFresh, version, doors],
  );
  const refreshFailed =
    conflict !== null &&
    !planQuery.isFetching &&
    !layoutsQuery.isFetching &&
    (planQuery.isError || layoutsQuery.isError);
  const diff: StateDiff | null = useMemo(
    () => (serverState ? diffEditorStates(baseline, serverState) : null),
    [serverState, baseline],
  );

  const send = (expectedVersion: number) => {
    const sent = state;
    const sentAt = Date.now();
    setError(null);
    mutation.mutate(
      { loadPlanId, payload: buildPlacementsPayload(sent, expectedVersion) },
      {
        onSuccess: input.onSaved,
        onError: (e) => {
          if (isPlacementViolation(e)) setServerIssues(serverIssuesOf(e, sent));
          else if (isOptimisticLockError(e))
            setConflict({ kind: "lock", message: loadPlanErrorMessage(e), sentAt });
          else if (e.status === 409 || e.status === 404 || isStaleLoadPlanError(e))
            setConflict({ kind: "stale", message: loadPlanErrorMessage(e), sentAt });
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
    /** Tải lại bản máy chủ lỗi (mạng, 5xx): hiện nút "Thử lại" thay vì chờ mãi. */
    refreshFailed,
    retry: () => {
      void planQuery.refetch();
      void layoutsQuery.refetch();
    },
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
