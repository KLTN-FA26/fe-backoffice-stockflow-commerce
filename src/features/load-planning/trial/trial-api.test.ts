import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiTrialEstimate } from "../__fixtures__/trial";

import { trialErrorMessage } from "./trial-errors";
import { runTrialEstimate, TRIAL_ESTIMATE_PATH } from "./trial-api";
import { TrialRunInputSchema } from "./trial-schemas";

afterEach(() => vi.restoreAllMocks());

const line = {
  name: "Hộp A",
  group: "VIS-1",
  lengthMm: 900,
  widthMm: 720,
  heightMm: 1310,
  quantity: 10,
  rotatable: true,
};
const input = { lines: [line], vehicleTypeIds: ["vt-40hc"], selectionMode: "SINGLE_TYPE" as const };

describe("runTrialEstimate", () => {
  it("POST /fulfillment/load-estimates/trial với danh sách dòng → parse tại biên, trial=true", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiTrialEstimate() });
    const estimate = await runTrialEstimate(input);
    expect(TRIAL_ESTIMATE_PATH).toBe("/fulfillment/load-estimates/trial");
    expect(post).toHaveBeenCalledWith("/fulfillment/load-estimates/trial", input);
    expect(estimate.trial).toBe(true);
    expect(estimate.vehicles[0]?.code).toBe("40HC");
    expect(estimate.unplaced[0]?.reason).toBe("NO_SPACE");
  });

  it("câu trả lời không phải trial=true (vd một ước tính đã lưu) → ném ZodError, không hiển thị như chạy thử", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: apiTrialEstimate({ trial: false }) });
    await expect(runTrialEstimate(input)).rejects.toThrow();
    vi.spyOn(api, "post").mockResolvedValue({ data: { ...apiTrialEstimate(), vehicles: "nope" } });
    await expect(runTrialEstimate(input)).rejects.toThrow();
  });
});

describe("TrialRunInputSchema", () => {
  it("nhận danh sách hợp lệ; loại xe rỗng = mọi loại đang dùng", () => {
    expect(TrialRunInputSchema.safeParse({ ...input, vehicleTypeIds: [] }).success).toBe(true);
  });

  it("giới hạn thùng như ước tính thật: cộng dồn quá 3 000 kiện thì từ chối, đúng 3 000 thì nhận", () => {
    const lines = (a: number, b: number) => [
      { ...line, quantity: a },
      { ...line, quantity: b },
    ];
    expect(TrialRunInputSchema.safeParse({ ...input, lines: lines(2000, 1000) }).success).toBe(
      true,
    );
    expect(TrialRunInputSchema.safeParse({ ...input, lines: lines(2000, 1001) }).success).toBe(
      false,
    );
  });

  it("không dòng, kích thước / số kiện không dương, quá 100 000 mm, quá 20 loại xe, cách chọn lạ → từ chối", () => {
    const bad = (patch: Record<string, unknown>) =>
      TrialRunInputSchema.safeParse({ ...input, lines: [{ ...line, ...patch }] }).success;
    expect(TrialRunInputSchema.safeParse({ ...input, lines: [] }).success).toBe(false);
    expect(bad({ lengthMm: 0 })).toBe(false);
    expect(bad({ widthMm: 1.5 })).toBe(false);
    expect(bad({ heightMm: 100_001 })).toBe(false);
    expect(bad({ quantity: 0 })).toBe(false);
    expect(bad({ name: "x".repeat(201) })).toBe(false);
    expect(
      TrialRunInputSchema.safeParse({
        ...input,
        vehicleTypeIds: Array.from({ length: 21 }, (_, i) => `v${i}`),
      }).success,
    ).toBe(false);
    expect(TrialRunInputSchema.safeParse({ ...input, selectionMode: "NOPE" }).success).toBe(false);
  });
});

describe("trialErrorMessage — lỗi BE → tiếng Việt", () => {
  it("quá 3 000 kiện, loại xe ngừng dùng / không còn, 403, mất mạng", () => {
    expect(trialErrorMessage(new ApiError(422, "LOAD_ESTIMATE_TOO_MANY_CARTONS", "x"))).toMatch(
      /3000/,
    );
    expect(trialErrorMessage(new ApiError(409, "VEHICLE_TYPE_INACTIVE", "x"))).toMatch(
      /ngừng dùng/,
    );
    expect(trialErrorMessage(new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "x"))).toMatch(
      /không còn tồn tại/,
    );
    expect(trialErrorMessage(new ApiError(403, "HTTP_403", "x"))).toMatch(/không có quyền/);
    expect(trialErrorMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toMatch(/Không kết nối/);
  });

  it("VALIDATION_FAILED nêu dòng sai (lines[i] → dòng i+1); lỗi khác → câu chung", () => {
    const withField = new ApiError(400, "VALIDATION_FAILED", "x", {
      "lines[2].widthMm": "must be at most 100000",
    });
    expect(trialErrorMessage(withField)).toBe(
      "Dòng thứ 3 trong danh sách không hợp lệ (kích thước hoặc số kiện không đúng giới hạn).",
    );
    expect(
      trialErrorMessage(
        new ApiError(400, "VALIDATION_FAILED", "x", { lines: "must not be empty" }),
      ),
    ).toMatch(/Dữ liệu không hợp lệ/);
    expect(trialErrorMessage(new ApiError(500, "HTTP_500", "x"))).toBe(
      "Không chạy thử được. Vui lòng thử lại.",
    );
    expect(trialErrorMessage(new Error("boom"))).toBe("Không chạy thử được. Vui lòng thử lại.");
  });
});
