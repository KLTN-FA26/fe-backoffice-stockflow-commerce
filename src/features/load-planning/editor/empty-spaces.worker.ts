/// <reference lib="webworker" />
/**
 * Tính khoảng trống cực đại ngoài luồng giao diện: `computeEmptySpaces` mất ~1,9 s trên 40HC 438 kiện (README "Known
 * limits"), chạy trong luồng chính sẽ đứng cả khung 3D mỗi lần chọn kiện ở khay. Kết quả gắn `id` của yêu cầu để bên
 * gọi bỏ kết quả cũ khi dữ liệu đã đổi.
 */

import { computeEmptySpaces } from "../lib/empty-spaces";

import type { Space } from "../lib/empty-spaces";
import type { BlockMm, ExtentMm } from "../types";

export interface EmptySpacesRequest {
  id: number;
  extent: ExtentMm;
  /** Kiện đã xếp và khối gia cố (đều là vật cản). */
  obstacles: BlockMm[];
}

export interface EmptySpacesResponse {
  id: number;
  spaces: Space[];
}

self.onmessage = (event: MessageEvent<EmptySpacesRequest>) => {
  const { id, extent, obstacles } = event.data;
  const response: EmptySpacesResponse = { id, spaces: computeEmptySpaces(extent, obstacles) };
  self.postMessage(response);
};
