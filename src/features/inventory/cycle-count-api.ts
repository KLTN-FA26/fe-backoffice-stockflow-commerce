import { CYCLE_COUNT_API } from "@/constants/cycle-count";

import {
  addCountLineInput,
  cancelCycleCountInput,
  countLineInput,
  cycleCountDto,
  cycleCountListInput,
  cycleCountPageDto,
  recountCycleCountInput,
} from "./cycle-count-schemas";
import { inventoryRequest } from "./transport";

import type {
  AddCountLineInput,
  CancelCycleCountInput,
  CountLineInput,
  CycleCountListParams,
  RecountCycleCountInput,
} from "./cycle-count-types";

export function listCycleCounts(params: CycleCountListParams, signal?: AbortSignal) {
  return inventoryRequest(
    { url: CYCLE_COUNT_API.list, params: cycleCountListInput.parse(params), signal },
    cycleCountPageDto,
  );
}

// For a counter on a blind count the BE answers without the books, the note and the adjustments (docs 20 BR-07).
export function getCycleCount(id: string, signal?: AbortSignal) {
  return inventoryRequest({ url: CYCLE_COUNT_API.detail(id), signal }, cycleCountDto);
}

/** Một dòng: thùng được quét có mặt (`found: true`) hoặc không thấy (`found: false`) — docs 20 §4.2 b4. */
export function countCycleCountLine(
  id: string,
  lineId: string,
  input: CountLineInput,
  signal?: AbortSignal,
) {
  return inventoryRequest(
    {
      url: CYCLE_COUNT_API.line(id, lineId),
      method: "PUT",
      data: countLineInput.parse(input),
      signal,
    },
    cycleCountDto,
  );
}

/** Thùng thấy ngoài kế hoạch (docs 20 §4.2 b5): LPN quét tại đúng vị trí sổ ghi thùng. */
export function addCycleCountLine(id: string, input: AddCountLineInput) {
  return inventoryRequest(
    { url: CYCLE_COUNT_API.addLine(id), method: "POST", data: addCountLineInput.parse(input) },
    cycleCountDto,
  );
}

/** Nộp phiếu đã đếm hết (docs 20 §4.2 c7–c8): mỗi thùng chênh lệch sinh một điều chỉnh COUNT_VARIANCE. */
export function submitCycleCount(id: string) {
  return inventoryRequest({ url: CYCLE_COUNT_API.submission(id), method: "POST" }, cycleCountDto);
}

export function cancelCycleCount(id: string, input: CancelCycleCountInput) {
  return inventoryRequest(
    {
      url: CYCLE_COUNT_API.cancellation(id),
      method: "POST",
      data: cancelCycleCountInput.parse(input),
    },
    cycleCountDto,
  );
}

/** Đếm lại các dòng đã chọn (docs 20 §4.2 d11): trả về phiếu kiểm mù MỚI, phiếu cũ giữ nguyên. */
export function recountCycleCount(id: string, input: RecountCycleCountInput) {
  const parsed = recountCycleCountInput.parse(input);
  return inventoryRequest(
    {
      url: CYCLE_COUNT_API.recounts(id),
      method: "POST",
      data: { lineIds: parsed.lineIds, note: parsed.note || undefined },
    },
    cycleCountDto,
  );
}
