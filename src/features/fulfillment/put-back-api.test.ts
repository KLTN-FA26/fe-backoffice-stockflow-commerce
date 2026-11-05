import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_FIELD_MESSAGES as MSG } from "@/constants";
import { api } from "@/lib/api/client";

import { PICK_LINE_1, apiPickLine, apiPutBackRow } from "./__fixtures__/pick-lines";
import { TASK_ID, WAREHOUSE_ID, bePage } from "./__fixtures__/task";
import { listPutBacks, putBackLine } from "./put-back-api";
import { bePutBackRowSchema, putBackInputSchema } from "./put-back-schemas";

afterEach(() => vi.restoreAllMocks());

describe("put-back — hợp đồng BE FulfillmentController#putBacks / #putBack (SCRUM-275)", () => {
  it("parse dòng hàng đợi thiếu lô (Jackson non_null)", () => {
    const { lotNumber: _lot, ...row } = apiPutBackRow();
    expect(bePutBackRowSchema.parse(row).lotNumber).toBeUndefined();
  });

  it("dòng thiếu pickedAt (Instant null → Jackson bỏ field) vẫn parse, không làm hỏng cả trang", () => {
    const { pickedAt: _at, ...row } = apiPutBackRow();
    expect(bePutBackRowSchema.parse(row).pickedAt).toBeUndefined();
  });

  it("listPutBacks lấy 1 trang tối đa 200, không gửi warehouseId khi không lọc kho", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([apiPutBackRow()]) });
    const page = await listPutBacks({});
    expect(get).toHaveBeenCalledWith(
      "/fulfillment/put-backs",
      expect.objectContaining({ params: { page: 0, size: 200 } }),
    );
    expect(page.items[0]?.sku).toBe("TEE-BLK-M");
  });

  it("listPutBacks gửi warehouseId khi lọc kho", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([]) });
    await listPutBacks({ warehouseId: WAREHOUSE_ID });
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: { page: 0, size: 200, warehouseId: WAREHOUSE_ID },
    });
  });

  it("putBackLine gửi PutBackRequest + Idempotency-Key, trả dòng Put Back", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: apiPickLine({
        status: "PUT_BACK",
        pickedQty: 3,
        putBackQty: 3,
        putBackLocationCode: "HN-A01-01-01-A",
      }),
    });
    const line = await putBackLine({
      taskId: TASK_ID,
      lineId: PICK_LINE_1,
      locationCode: "HN-A01-01-01-A",
      idempotencyKey: "k",
    });
    expect(post).toHaveBeenCalledWith(
      `/fulfillment/tasks/${TASK_ID}/pick-lines/${PICK_LINE_1}/put-back`,
      { locationCode: "HN-A01-01-01-A" },
      { headers: { "Idempotency-Key": "k" } },
    );
    expect(line.status).toBe("Put Back");
  });

  it("putBackInputSchema: vị trí trống → bắt chọn, quá 64 ký tự → lỗi, trim mã", () => {
    const first = (value: string) =>
      putBackInputSchema.safeParse({ locationCode: value }).error?.issues[0]?.message;
    expect(first(" ")).toBe(MSG.locationRequired);
    expect(first("x".repeat(65))).toBe(MSG.codeTooLong);
    expect(putBackInputSchema.parse({ locationCode: " HN-1 " })).toEqual({ locationCode: "HN-1" });
  });
});
