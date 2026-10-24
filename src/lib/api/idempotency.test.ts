import { describe, expect, it } from "vitest";

import {
  createIdempotencyAttempt,
  idempotencyKeyStillUsable,
  idempotencyRequestConfig,
  IDEMPOTENCY_KEY_HEADER,
  newIdempotencyKey,
} from "./idempotency";

const counter = () => {
  let n = 0;
  return () => `key-${++n}`;
};

describe("idempotencyRequestConfig", () => {
  it("có key → header Idempotency-Key cho đúng một request; không key → không thêm gì", () => {
    expect(idempotencyRequestConfig("k-1")).toEqual({
      headers: { [IDEMPOTENCY_KEY_HEADER]: "k-1" },
    });
    expect(idempotencyRequestConfig(undefined)).toBeUndefined();
  });
});

describe("idempotencyKeyStillUsable — theo cách BE nhả hay chốt kết quả", () => {
  it.each([
    [0, "NETWORK_ERROR"],
    [500, "HTTP_500"],
    [502, "HTTP_502"],
    [408, "X"],
    [409, "OPTIMISTIC_LOCK"],
    [409, "LOCK_TIMEOUT"],
    [409, "IDEMPOTENT_REQUEST_IN_PROGRESS"],
    [423, "X"],
    [429, "X"],
  ])("%s %s: BE nhả claim hoặc không biết → GIỮ key", (status, code) => {
    expect(idempotencyKeyStillUsable({ status, code })).toBe(true);
  });

  it.each([
    [400, "VALIDATION_FAILED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [422, "LOAD_ESTIMATE_PACKAGING_MISSING"],
  ])("%s %s: BE đã LƯU kết quả → BỎ key (không bị trả lại mãi)", (status, code) => {
    expect(idempotencyKeyStillUsable({ status, code })).toBe(false);
  });

  it("IDEMPOTENCY_KEY_REUSED (422) → bỏ key", () => {
    expect(idempotencyKeyStillUsable({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" })).toBe(false);
  });
});

describe("createIdempotencyAttempt", () => {
  it("cùng nội dung → cùng key (kể cả đổi thứ tự thuộc tính); nội dung khác → key mới", () => {
    const attempt = createIdempotencyAttempt(counter());
    const first = attempt.keyFor({ id: "o-1", warehouseId: "wh-1" });
    expect(attempt.keyFor({ warehouseId: "wh-1", id: "o-1" })).toBe(first);
    expect(attempt.keyFor({ id: "o-1", warehouseId: "wh-2" })).not.toBe(first);
  });

  it("thuộc tính undefined không đổi vân tay", () => {
    const attempt = createIdempotencyAttempt(counter());
    const first = attempt.keyFor({ id: "o-1", deliveryMode: undefined });
    expect(attempt.keyFor({ id: "o-1" })).toBe(first);
  });

  it("lỗi nhả claim (409 / 5xx / mạng) → giữ key cho lần bấm lại; lỗi đã chốt (400) → key mới", () => {
    const attempt = createIdempotencyAttempt(counter());
    const request = { id: "o-1" };
    const k1 = attempt.keyFor(request);
    attempt.settle({ status: 409, code: "LOCK_TIMEOUT" });
    expect(attempt.keyFor(request)).toBe(k1);
    attempt.settle({ status: 0, code: "NETWORK_ERROR" });
    expect(attempt.keyFor(request)).toBe(k1);
    attempt.settle({ status: 400, code: "VALIDATION_FAILED" });
    expect(attempt.keyFor(request)).not.toBe(k1);
  });

  it("thành công (reset) → lần sau key mới", () => {
    const attempt = createIdempotencyAttempt(counter());
    const k1 = attempt.keyFor({ id: "o-1" });
    attempt.reset();
    expect(attempt.keyFor({ id: "o-1" })).not.toBe(k1);
  });
});

// Dùng chung cho mọi thao tác ghi của đơn (huỷ, duyệt / từ chối công nợ, release…), không riêng release
describe("Idempotency-Key — các thao tác ghi khác của đơn", () => {
  it("key sinh ra hợp lệ với BE (8–255 ký tự letters/digits/-_:.), mỗi lần khác nhau", () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[A-Za-z0-9\-_:.]{8,255}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });

  it("quay lại nội dung cũ là yêu cầu mới — không bao giờ một key cho hai nội dung", () => {
    const attempt = createIdempotencyAttempt(counter());
    const k1 = attempt.keyFor({ id: "o1", note: "a" });
    attempt.keyFor({ id: "o1", note: "b" });
    expect(attempt.keyFor({ id: "o1", note: "a" })).not.toBe(k1);
  });

  it("hai lần thử độc lập (hai dialog) không chia key", () => {
    const generate = counter();
    const a = createIdempotencyAttempt(generate);
    const b = createIdempotencyAttempt(generate);
    expect(a.keyFor({ id: "o1" })).not.toBe(b.keyFor({ id: "o1" }));
  });
});
