/**
 * Luật dời cửa sổ giao thuần (docs 17 BR-28) + vòng đời trạng thái hiển thị của đợt (§5.5).
 */
import { describe, expect, it } from "vitest";

import { DELIVERY_BATCH_TRANSITIONS, WINDOW_MOVABLE_STATES } from "./delivery-batch-lifecycle";
import { DELIVERY_BATCH_STATES } from "./delivery-batch-schemas";
import {
  evidenceFileProblem,
  formatWindowRange,
  isWindowMovable,
  isWindowMoved,
  windowOrderViolation,
} from "./delivery-window-rules";

import type { DeliveryBatch } from "./delivery-batch-api";

const batch = (seq: number, windowStart: string | null) => ({
  seq,
  state: "READY" as const,
  windowStart,
  windowEnd: windowStart,
});

describe("DELIVERY_BATCH_TRANSITIONS (docs 17 §5.5)", () => {
  it("đủ năm trạng thái hiển thị — không thiếu, không thừa", () => {
    expect(Object.keys(DELIVERY_BATCH_TRANSITIONS).sort()).toEqual(
      [...DELIVERY_BATCH_STATES].sort(),
    );
  });

  it("Chờ hàng → Sẵn sàng / Đã đóng; Sẵn sàng → Đang giao / Chờ hàng; Đang giao → Đã giao / Đã đóng", () => {
    expect(DELIVERY_BATCH_TRANSITIONS.AWAITING_STOCK).toEqual(["READY", "CLOSED"]);
    expect(DELIVERY_BATCH_TRANSITIONS.READY).toEqual(["IN_DELIVERY", "AWAITING_STOCK"]);
    expect(DELIVERY_BATCH_TRANSITIONS.IN_DELIVERY).toEqual(["DELIVERED", "CLOSED"]);
  });

  it("Đã giao và Đã đóng là terminal — không chuyển tiếp nào", () => {
    expect(DELIVERY_BATCH_TRANSITIONS.DELIVERED).toEqual([]);
    expect(DELIVERY_BATCH_TRANSITIONS.CLOSED).toEqual([]);
  });

  it("BR-28: chỉ dời được khi chưa bàn giao thùng nào — mọi trạng thái còn lại (kể cả lạ) khoá", () => {
    expect([...WINDOW_MOVABLE_STATES].sort()).toEqual(["AWAITING_STOCK", "READY"]);
    for (const state of DELIVERY_BATCH_STATES) {
      expect(isWindowMovable({ state })).toBe(state === "AWAITING_STOCK" || state === "READY");
    }
    // Trạng thái BE mới FE chưa biết → không mở nút (không đoán là "chưa bàn giao")
    expect(isWindowMovable({ state: "UNKNOWN" })).toBe(false);
  });
});

describe("windowOrderViolation — BR-28 giữ thứ tự với các đợt khác", () => {
  const schedule = [batch(1, "2026-12-01"), batch(2, "2026-12-15"), batch(3, "2026-12-20")];

  it("dời đợt 2 trong khoảng [đợt 1, đợt 3] → hợp lệ", () => {
    expect(windowOrderViolation(schedule, 2, "2026-12-01")).toBeNull();
    expect(windowOrderViolation(schedule, 2, "2026-12-18")).toBeNull();
    expect(windowOrderViolation(schedule, 2, "2026-12-20")).toBeNull();
  });

  it("đợt 1 dời qua đợt 2 → đợt 2 là đợt bị phạm (cần dời cả các đợt sau)", () => {
    expect(windowOrderViolation(schedule, 1, "2026-12-16")).toBe(2);
  });

  it("đợt 2 dời trước đợt 1 → chính đợt 2 bị phạm; đợt 2 dời sau đợt 3 → đợt 3 bị phạm", () => {
    expect(windowOrderViolation(schedule, 2, "2026-11-30")).toBe(2);
    expect(windowOrderViolation(schedule, 2, "2026-12-25")).toBe(3);
  });

  it("đợt không có ngày bắt đầu bị bỏ qua; thứ tự mảng không quan trọng", () => {
    expect(
      windowOrderViolation([batch(1, null), batch(2, "2026-12-15")], 2, "2026-12-01"),
    ).toBeNull();
    expect(windowOrderViolation([...schedule].reverse(), 1, "2026-12-16")).toBe(2);
  });
});

describe("formatWindowRange / isWindowMoved", () => {
  it("định dạng dd/MM/yyyy từ chuỗi ISO, không lệch múi giờ; thiếu ngày hiện …", () => {
    expect(formatWindowRange("2026-12-01", "2026-12-05")).toBe("01/12/2026 – 05/12/2026");
    expect(formatWindowRange("2026-12-01T00:00:00Z", null)).toBe("01/12/2026 – …");
  });

  it("đã dời khi cửa sổ hiệu lực khác cửa sổ hợp đồng", () => {
    const base = {
      contractWindowStart: "2026-12-01",
      contractWindowEnd: "2026-12-05",
      windowStart: "2026-12-01",
      windowEnd: "2026-12-05",
    } satisfies Pick<
      DeliveryBatch,
      "contractWindowStart" | "contractWindowEnd" | "windowStart" | "windowEnd"
    >;
    expect(isWindowMoved(base)).toBe(false);
    expect(isWindowMoved({ ...base, windowStart: "2026-12-08" })).toBe(true);
    expect(isWindowMoved({ ...base, windowEnd: "2026-12-09" })).toBe(true);
  });
});

describe("evidenceFileProblem — chặn sớm tệp bằng chứng (BE FileCategory.DOCUMENT)", () => {
  const MB = 1024 * 1024;

  it("PDF / Word / Excel / JPEG / PNG ≤ 25 MB hợp lệ", () => {
    for (const type of [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ]) {
      expect(evidenceFileProblem({ type, size: 25 * MB })).toBeNull();
    }
  });

  it("quá 25 MB, rỗng, hoặc loại khác (WebP, text, exe, không rõ loại) → câu tiếng Việt", () => {
    expect(evidenceFileProblem({ type: "application/pdf", size: 25 * MB + 1 })).toMatch(/quá lớn/);
    expect(evidenceFileProblem({ type: "application/pdf", size: 0 })).toMatch(/trống/);
    for (const type of ["image/webp", "text/plain", "application/x-msdownload", ""]) {
      expect(evidenceFileProblem({ type, size: 10 })).toMatch(/Loại tệp không được nhận/);
    }
  });
});
