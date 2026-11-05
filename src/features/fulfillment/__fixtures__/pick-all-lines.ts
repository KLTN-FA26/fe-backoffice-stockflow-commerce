/**
 * Test helper (mock adapter): người được gán xác nhận đủ các dòng còn mở của task — BE chỉ cho hoàn tất lấy
 * hàng khi mọi dòng đã PICKED / CANCELLED (`PickList.requireAllPicked`, 409 PICK_LINES_INCOMPLETE).
 */

import { confirmPickLine, listPickLines } from "../pick-line-api";

export async function pickAllOpenLines(taskId: string): Promise<void> {
  for (const line of await listPickLines(taskId)) {
    if (line.status !== "Open") continue;
    await confirmPickLine({
      taskId,
      lineId: line.lineId,
      values: {
        locationCode: line.locationCode,
        scannedCode: line.sku,
        quantity: line.allocatedQty,
      },
      idempotencyKey: `pick-all-${line.lineId}`,
    });
  }
}
