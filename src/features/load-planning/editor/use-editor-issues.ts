"use client";

import { useMemo } from "react";

import { activeServerIssues, mergeIssues } from "./issues";
import { isVehicleKey, issuesByKey, precheck, vehicleKey } from "./precheck";

import type { BoxTone } from "../lib/editor-scene";
import type { ServerIssue } from "./issues";
import type { EditorState } from "./types";

/**
 * Vi phạm đang hiện = kiểm tra tại chỗ (`precheck`) + vi phạm máy chủ báo ở lần lưu trước còn đúng với kiện chưa bị sửa.
 * Kèm màu tô từng kiện (đang chọn thắng vi phạm vì người dùng đang làm việc với kiện đó — lỗi hiện ở bảng điều khiển)
 * và các xe có lỗi.
 */
export function useEditorIssues(
  state: EditorState,
  selected: readonly string[],
  serverIssues: readonly ServerIssue[],
) {
  const serverActive = useMemo(
    () => activeServerIssues(serverIssues, state),
    [serverIssues, state],
  );
  const issues = useMemo(() => mergeIssues(precheck(state), serverActive), [state, serverActive]);
  const rulesOf = useMemo(() => issuesByKey(issues), [issues]);
  const serverKeys = useMemo(
    () => new Set(serverActive.map((issue) => `${issue.key}#${issue.rule}`)),
    [serverActive],
  );
  const tones = useMemo(() => {
    const map = new Map<string, BoxTone>();
    for (const key of rulesOf.keys()) if (!isVehicleKey(key)) map.set(key, "violation");
    for (const ref of selected) map.set(ref, "selected");
    return map;
  }, [rulesOf, selected]);
  const flaggedSeqs = useMemo(
    () =>
      new Set(
        state.vehicles
          .filter((v) => rulesOf.has(vehicleKey(v.seq)) || v.boxes.some((b) => rulesOf.has(b.ref)))
          .map((v) => v.seq),
      ),
    [state.vehicles, rulesOf],
  );
  return { issues, rulesOf, serverKeys, serverActive, tones, flaggedSeqs };
}
