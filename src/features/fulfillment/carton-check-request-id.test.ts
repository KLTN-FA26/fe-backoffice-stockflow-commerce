import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearCompletionRequestId, completionRequestId } from "./carton-check-request-id";

const KEY = (task: string) => `stockflow:admin:packing:completion:${task}`;
const storedId = (task: string): string =>
  JSON.parse(window.sessionStorage.getItem(KEY(task)) ?? "{}").id;

beforeEach(() => window.sessionStorage.clear());

describe("requestId của lần hoàn tất — nhớ theo task + tập thùng đã dán nhãn chưa vào shipment", () => {
  it("cùng task và cùng tập thùng (kể cả khác thứ tự) → cùng id; task khác → id khác", () => {
    const first = completionRequestId("task-a", ["p2", "p1"]);
    expect(completionRequestId("task-a", ["p1", "p2"])).toBe(first);
    expect(completionRequestId("task-b", ["p1", "p2"])).not.toBe(first);
    expect(storedId("task-a")).toBe(first);
  });

  it("tập thùng đổi (dán nhãn thêm / loại thùng) → id mới: BE không trả lại shipment CŨ cho đợt thùng mới", () => {
    const first = completionRequestId("task-a", ["p1"]);
    const second = completionRequestId("task-a", ["p1", "p2"]);
    expect(second).not.toBe(first);
    expect(completionRequestId("task-a", ["p1", "p2"])).toBe(second);
    // Quay lại tập cũ cũng là id mới: shipment của id cũ có thể đã được tạo
    expect(completionRequestId("task-a", ["p1"])).not.toBe(first);
  });

  it("xoá khi shipment đã tạo → lần sau id mới", () => {
    const first = completionRequestId("task-a", ["p1"]);
    clearCompletionRequestId("task-a");
    expect(window.sessionStorage.getItem(KEY("task-a"))).toBeNull();
    expect(completionRequestId("task-a", ["p1"])).not.toBe(first);
  });

  it("giá trị lưu hỏng / định dạng cũ (chuỗi id trần) → bỏ, sinh id mới", () => {
    window.sessionStorage.setItem(KEY("task-a"), "old-plain-id");
    const id = completionRequestId("task-a", ["p1"]);
    expect(id).not.toBe("old-plain-id");
    expect(storedId("task-a")).toBe(id);
  });

  it("sessionStorage bị chặn → vẫn giữ id trong bộ nhớ, không ném lỗi", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const id = completionRequestId("task-blocked", ["p1"]);
    expect(completionRequestId("task-blocked", ["p1"])).toBe(id);
    expect(completionRequestId("task-blocked", ["p1", "p2"])).not.toBe(id);
    expect(() => clearCompletionRequestId("task-blocked")).not.toThrow();
    vi.restoreAllMocks();
  });
});
