import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { PICK_LINE_1, PICK_LINE_2, PICK_LINE_3, apiPickLine } from "./__fixtures__/pick-lines";
import { TASK_ID, bePage } from "./__fixtures__/task";
import {
  confirmPickLine,
  listPickLines,
  reallocateShortLine,
  reportShortPick,
} from "./pick-line-api";

afterEach(() => vi.restoreAllMocks());

const LINES_PATH = `/fulfillment/tasks/${TASK_ID}/pick-lines`;

describe("pick-line API — hợp đồng BE FulfillmentController (SCRUM-267, PR #147)", () => {
  it("listPickLines lấy trang tối đa 200 dòng, map status sang tên Title Case", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage(
        [apiPickLine(), apiPickLine({ lineId: PICK_LINE_2, status: "PUT_BACK" })],
        0,
        200,
      ),
    });
    const lines = await listPickLines(TASK_ID);
    expect(get).toHaveBeenCalledWith(
      LINES_PATH,
      expect.objectContaining({ params: { page: 0, size: 200 } }),
    );
    expect(lines.map((line) => line.status)).toEqual(["Open", "Put Back"]);
  });

  it("task > 200 dòng: tải tiếp các trang sau, nối đúng thứ tự", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({
        data: { ...bePage([apiPickLine()], 0, 200), totalPages: 2, hasNext: true },
      })
      .mockResolvedValueOnce({
        data: bePage([apiPickLine({ lineId: PICK_LINE_2, sequenceNo: 201 })], 1, 200),
      });
    const lines = await listPickLines(TASK_ID);
    expect(lines.map((line) => line.lineId)).toEqual([PICK_LINE_1, PICK_LINE_2]);
    expect(get).toHaveBeenNthCalledWith(
      2,
      LINES_PATH,
      expect.objectContaining({ params: { page: 1, size: 200 } }),
    );
  });

  it("confirmPickLine gửi đúng ConfirmPickRequest + Idempotency-Key, parse dòng trả về", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: apiPickLine({ status: "PICKED", pickedQty: 3 }) });
    const line = await confirmPickLine({
      taskId: TASK_ID,
      lineId: PICK_LINE_1,
      values: { locationCode: "HN-A01-01-01-A", scannedCode: "TEE-BLK-M", quantity: 3 },
      idempotencyKey: "key-1",
    });
    expect(post).toHaveBeenCalledWith(
      `${LINES_PATH}/${PICK_LINE_1}/confirmation`,
      { locationCode: "HN-A01-01-01-A", scannedCode: "TEE-BLK-M", quantity: 3 },
      { headers: { "Idempotency-Key": "key-1" } },
    );
    expect(line).toMatchObject({ status: "Picked", pickedQty: 3 });
  });

  it("reportShortPick gửi ShortPickRequest {locationCode, foundQuantity} + Idempotency-Key", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: apiPickLine({ status: "SHORT", shortQty: 2 }) });
    const line = await reportShortPick({
      taskId: TASK_ID,
      lineId: PICK_LINE_1,
      values: { locationCode: "HN-A01-01-01-A", foundQuantity: 1 },
      idempotencyKey: "key-2",
    });
    expect(post).toHaveBeenCalledWith(
      `${LINES_PATH}/${PICK_LINE_1}/short`,
      { locationCode: "HN-A01-01-01-A", foundQuantity: 1 },
      { headers: { "Idempotency-Key": "key-2" } },
    );
    expect(line).toMatchObject({ status: "Short", shortQty: 2 });
  });

  it("reallocateShortLine: POST không body, trả các dòng mới", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: [apiPickLine({ lineId: PICK_LINE_3, sequenceNo: 4, locationCode: "HN-B01-01-01-A" })],
    });
    const lines = await reallocateShortLine({
      taskId: TASK_ID,
      lineId: PICK_LINE_1,
      idempotencyKey: "key-3",
    });
    expect(post).toHaveBeenCalledWith(`${LINES_PATH}/${PICK_LINE_1}/reallocation`, undefined, {
      headers: { "Idempotency-Key": "key-3" },
    });
    expect(lines).toEqual([
      expect.objectContaining({ lineId: PICK_LINE_3, status: "Open", sequenceNo: 4 }),
    ]);
  });
});
