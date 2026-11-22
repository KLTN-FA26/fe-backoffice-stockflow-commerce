import { describe, expect, it } from "vitest";

import { PUTAWAY_ERROR_MESSAGES as M } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { putawayConfirmError } from "../errors";

const be = (
  status: number,
  code: string,
  details?: Record<string, unknown>,
  fields?: Record<string, string>,
) => new ApiError(status, code, code, fields, undefined, undefined, undefined, details);

describe("putawayConfirmError — lỗi BE → ô / banner (docs 05 §6 Edge case)", () => {
  it("sai thùng → ô LPN, nêu đúng LPN của nhiệm vụ", () => {
    expect(putawayConfirmError(be(409, "PUTAWAY_LPN_MISMATCH"), "LPN-1")).toEqual({
      field: "lpn",
      message: M.PUTAWAY_LPN_MISMATCH("LPN-1"),
      stale: false,
    });
  });

  it.each([
    "LOCATION_NOT_FOUND",
    "PUTAWAY_TARGET_NOT_BIN",
    "MOVE_ACROSS_WAREHOUSES",
    "LOCATION_NOT_USABLE",
    "CARTON_DOES_NOT_FIT_BIN",
    "LOCATION_CAPACITY_EXCEEDED",
  ])("%s → ô bin", (code) => {
    expect(putawayConfirmError(be(409, code), "LPN-1")).toMatchObject({
      field: "locationCode",
      stale: false,
    });
  });

  it("BR-13: OVERFLOW khi còn bin vừa → ô bin + đề nghị bin trong details.locationCode", () => {
    const out = putawayConfirmError(
      be(409, "PUTAWAY_OVERFLOW_NOT_ALLOWED", { locationCode: "HCM-A01-1-A" }),
      "LPN-1",
    );
    expect(out).toMatchObject({ field: "locationCode", alternative: "HCM-A01-1-A" });
    expect(out.message).toContain("HCM-A01-1-A");
  });

  it("details không phải chuỗi → không đề nghị bin", () => {
    const out = putawayConfirmError(
      be(409, "PUTAWAY_OVERFLOW_NOT_ALLOWED", { locationCode: 3 }),
      null,
    );
    expect(out).not.toHaveProperty("alternative");
  });

  it("đã cất / không còn nhiệm vụ → stale (tải lại)", () => {
    expect(putawayConfirmError(be(409, "PUTAWAY_TASK_DONE"), "LPN-1").stale).toBe(true);
    expect(putawayConfirmError(be(404, "PUTAWAY_TASK_NOT_FOUND"), "LPN-1").stale).toBe(true);
  });

  it("VALIDATION_FAILED có field → ô đó; không field → nhiệm vụ không còn cất được", () => {
    expect(
      putawayConfirmError(
        be(400, "VALIDATION_FAILED", undefined, { lpn: "must not be blank" }),
        "LPN-1",
      ),
    ).toMatchObject({ field: "lpn" });
    expect(putawayConfirmError(be(400, "VALIDATION_FAILED"), "LPN-1")).toEqual({
      message: M.notActionable,
      stale: true,
    });
  });

  it("lỗi không phải ApiError → banner chung", () => {
    expect(putawayConfirmError(new Error("x"), "LPN-1")).toEqual({
      message: M.generic,
      stale: false,
    });
  });
});
