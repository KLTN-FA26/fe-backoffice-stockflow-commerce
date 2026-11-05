"use client";

import { useEffect, useRef, useState } from "react";

import { computeEmptySpaces } from "../lib/empty-spaces";

import type { Space } from "../lib/empty-spaces";
import type { BlockMm, ExtentMm } from "../types";
import type { EmptySpacesRequest, EmptySpacesResponse } from "./empty-spaces.worker";

/** Việc cần tính: tham chiếu đổi = dữ liệu đổi (tạo bằng `useMemo` ở nơi gọi), nên kết quả cũ bị bỏ. */
export interface EmptySpaceJob {
  extent: ExtentMm;
  obstacles: readonly BlockMm[];
}

export interface EmptySpacesState {
  /** Khoảng trống của đúng `job` hiện tại; null khi chưa có việc hoặc đang tính. */
  spaces: readonly Space[] | null;
  computing: boolean;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./empty-spaces.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

const bare = (b: BlockMm): BlockMm => ({
  xMm: b.xMm,
  yMm: b.yMm,
  zMm: b.zMm,
  wMm: b.wMm,
  hMm: b.hMm,
  dMm: b.dMm,
});

/**
 * Khoảng trống cực đại của một xe, tính trong web worker (README F1 "Known limits": `computeEmptySpaces` chậm). Mỗi
 * `job` mới huỷ kết quả của job cũ (số yêu cầu tăng dần, trả về chậm bị bỏ). Không có Worker (test jsdom, trình duyệt cũ)
 * hoặc worker lỗi thì tính ở luồng chính sau một nhịp để giao diện kịp hiện trạng thái "đang tính".
 */
export function useEmptySpaces(job: EmptySpaceJob | null): EmptySpacesState {
  const [done, setDone] = useState<{ job: EmptySpaceJob; spaces: readonly Space[] } | null>(null);
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  const jobs = useRef(new Map<number, EmptySpaceJob>());

  useEffect(() => {
    if (!job) return;
    const id = ++latest.current;
    jobs.current.set(id, job);
    const inline = () => {
      const spaces = computeEmptySpaces(job.extent, job.obstacles);
      if (id === latest.current) setDone({ job, spaces });
    };
    worker.current ??= createWorker();
    const client = worker.current;
    if (!client) {
      const timer = setTimeout(inline, 0);
      return () => clearTimeout(timer);
    }
    client.onmessage = (event: MessageEvent<EmptySpacesResponse>) => {
      const finished = jobs.current.get(event.data.id);
      jobs.current.delete(event.data.id);
      if (finished && event.data.id === latest.current)
        setDone({ job: finished, spaces: event.data.spaces });
    };
    client.onerror = () => {
      client.terminate();
      worker.current = null;
      inline();
    };
    const request: EmptySpacesRequest = {
      id,
      extent: job.extent,
      obstacles: job.obstacles.map(bare),
    };
    client.postMessage(request);
  }, [job]);

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
      jobs.current.clear();
    },
    [],
  );

  const ready = job !== null && done?.job === job;
  return { spaces: ready ? done.spaces : null, computing: job !== null && !ready };
}
