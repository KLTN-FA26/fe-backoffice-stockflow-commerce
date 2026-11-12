/**
 * Form dời cửa sổ giao (docs 17 BR-28): cửa sổ mới không ở quá khứ, giữ thứ tự các đợt, mã lý do + ghi chú + bằng chứng
 * (tin nhắn chat) bắt buộc.
 */
import { describe, expect, it } from "vitest";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";

import { buildWindowChangeSchema } from "./delivery-window-schemas";

const MESSAGE_ID = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10";
const schema = buildWindowChangeSchema({ today: "2026-11-12", orderViolation: () => null });

const valid = {
  windowStart: "2026-11-20",
  windowEnd: "2026-11-23",
  reasonCode: "CUSTOMER_REQUEST",
  note: "  Khách đồng ý nhận sớm trong chat  ",
  evidenceMessageId: ` ${MESSAGE_ID} `,
};

const messagesOf = (input: Record<string, unknown>, s = schema) => {
  const result = s.safeParse({ ...valid, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("buildWindowChangeSchema (BR-28)", () => {
  it("hợp lệ → note / mã tin nhắn được trim, giữ nguyên ngày và mã lý do", () => {
    expect(schema.parse(valid)).toEqual({
      windowStart: "2026-11-20",
      windowEnd: "2026-11-23",
      reasonCode: "CUSTOMER_REQUEST",
      note: "Khách đồng ý nhận sớm trong chat",
      evidenceMessageId: MESSAGE_ID,
    });
    expect(schema.safeParse({ ...valid, reasonCode: "SELLER_DELAY" }).success).toBe(true);
  });

  it("cửa sổ mới không được bắt đầu ở quá khứ; hôm nay thì được", () => {
    expect(messagesOf({ windowStart: "2026-11-11", windowEnd: "2026-11-15" })).toContain(
      L.startInPast,
    );
    expect(messagesOf({ windowStart: "2026-11-12", windowEnd: "2026-11-12" })).toEqual([]);
  });

  it("ngày kết thúc không trước ngày bắt đầu", () => {
    expect(messagesOf({ windowEnd: "2026-11-19" })).toContain(L.endBeforeStart);
    expect(messagesOf({ windowEnd: "2026-11-20" })).toEqual([]);
  });

  it("thiếu ngày → báo từng ô; ô chưa chọn (chuỗi rỗng) cũng thiếu", () => {
    expect(messagesOf({ windowStart: "" })).toContain(L.startRequired);
    expect(messagesOf({ windowEnd: "" })).toContain(L.endRequired);
  });

  it("thiếu mã lý do / mã lý do lạ → 'Chọn mã lý do'", () => {
    expect(messagesOf({ reasonCode: "" })).toEqual([L.reasonRequired]);
    expect(messagesOf({ reasonCode: "OTHER" })).toEqual([L.reasonRequired]);
  });

  it("ghi chú bắt buộc (chỉ khoảng trắng cũng không được) và tối đa 1000 ký tự", () => {
    expect(messagesOf({ note: "   " })).toEqual([L.noteRequired]);
    expect(messagesOf({ note: "x".repeat(1000) })).toEqual([]);
    expect(messagesOf({ note: "x".repeat(1001) })).toEqual([L.noteTooLong]);
  });

  it("bằng chứng: bắt buộc, phải là UUID", () => {
    expect(messagesOf({ evidenceMessageId: "" })).toEqual([L.evidenceRequired]);
    expect(messagesOf({ evidenceMessageId: "khong-phai-uuid" })).toEqual([L.evidenceInvalid]);
  });

  it("đợt bị phạm thứ tự → báo đúng số đợt, kèm gợi ý dời các đợt sau", () => {
    const ordered = buildWindowChangeSchema({
      today: "2026-11-12",
      orderViolation: (start) => (start > "2026-11-30" ? 2 : null),
    });
    expect(messagesOf({ windowStart: "2026-12-01", windowEnd: "2026-12-02" }, ordered)).toEqual([
      L.orderViolation(2),
    ]);
    expect(L.orderViolation(2)).toMatch(/dời cả các đợt sau/);
    expect(messagesOf({}, ordered)).toEqual([]);
  });
});
