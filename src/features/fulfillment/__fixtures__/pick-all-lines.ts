/**
 * Test helper (mock adapter): người được gán xác nhận đủ các dòng còn mở của task bằng cách quét vị trí + LPN —
 * BE chỉ cho hoàn tất lấy hàng khi mọi dòng đã PICKED / STAGED / CANCELLED (`PickList.requireAllPicked`, 409
 * PICK_LINES_INCOMPLETE).
 */

import { confirmPickLine, listPickLines } from "../pick-line-api";

export async function pickAllOpenLines(taskId: string): Promise<void> {
  for (const line of await listPickLines(taskId)) {
    if (line.status !== "Open") continue;
    await confirmPickLine({
      taskId,
      lineId: line.lineId,
      values: { locationCode: line.locationCode, lpn: line.lpn ?? "" },
      idempotencyKey: `pick-all-${line.lineId}`,
    });
  }
}
