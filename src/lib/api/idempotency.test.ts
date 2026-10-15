import { describe, expect, it } from "vitest";

import {
  IDEMPOTENCY_KEY_HEADER,
  createIdempotencyAttempt,
  idempotencyKeyStillUsable,
  idempotencyRequestConfig,
  newIdempotencyKey,
} from "./idempotency";

function sequence() {
  let n = 0;
  return () => `key-${++n}`;
}

const err = (status: number, code = `HTTP_${status}`) => ({ status, code });

describe("Idempotency-Key — gương BE IdempotencyFilter", () => {
  it("tên header đúng chữ BE; config chỉ cho một request, không có key → không có header", () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe("Idempotency-Key");
    expect(idempotencyRequestConfig("abc-12345")).toEqual({
      headers: { "Idempotency-Key": "abc-12345" },
    });
    expect(idempotencyRequestConfig(undefined)).toBeUndefined();
  });

  it("key sinh ra hợp lệ với BE (8–255 ký tự letters/digits/-_:.), mỗi lần khác nhau", () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[A-Za-z0-9\-_:.]{8,255}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });

  it("BE nhả claim (409 mọi mã, 408/423/425/429, 5xx) hoặc mất mạng → giữ key", () => {
    for (const e of [
      err(409, "OPTIMISTIC_LOCK"),
      err(409, "LOCK_TIMEOUT"),
      err(409, "IDEMPOTENT_REQUEST_IN_PROGRESS"),
      err(409, "PAYMENT_TERM_NOT_ALLOWED"),
      err(408),
      err(423),
      err(425),
      err(429),
      err(500),
      err(503),
      err(0, "NETWORK_ERROR"),
    ]) {
      expect(idempotencyKeyStillUsable(e), `${e.status} ${e.code}`).toBe(true);
    }
  });

  it("BE đã chốt kết quả (400/403/404/422…) hoặc KEY_REUSED → bỏ key", () => {
    for (const e of [
      err(400, "VALIDATION_FAILED"),
      err(403, "FORBIDDEN"),
      err(404, "NOT_FOUND"),
      err(422, "IDEMPOTENCY_KEY_REUSED"),
      err(422, "SOMETHING"),
    ]) {
      expect(idempotencyKeyStillUsable(e), `${e.status} ${e.code}`).toBe(false);
    }
  });
});

describe("createIdempotencyAttempt — một lần thử logic", () => {
  it("cùng nội dung → cùng key (thứ tự thuộc tính không quan trọng); nội dung khác → key mới", () => {
    const attempt = createIdempotencyAttempt(sequence());
    expect(attempt.keyFor({ id: "o1", note: "a" })).toBe("key-1");
    expect(attempt.keyFor({ note: "a", id: "o1" })).toBe("key-1");
    expect(attempt.keyFor({ id: "o1", note: "b" })).toBe("key-2");
    // Quay lại nội dung cũ: là yêu cầu mới, key mới — không bao giờ một key cho hai nội dung
    expect(attempt.keyFor({ id: "o1", note: "a" })).toBe("key-3");
  });

  it("lỗi BE nhả claim → bấm lại cùng nội dung dùng lại key", () => {
    const attempt = createIdempotencyAttempt(sequence());
    const k1 = attempt.keyFor({ id: "o1" });
    attempt.settle(err(409, "LOCK_TIMEOUT"));
    expect(attempt.keyFor({ id: "o1" })).toBe(k1);
  });

  it("lỗi BE đã lưu (400) → bấm lại cùng nội dung dùng key MỚI (không bị trả lại lỗi cũ 24 giờ)", () => {
    const attempt = createIdempotencyAttempt(sequence());
    const k1 = attempt.keyFor({ id: "o1" });
    attempt.settle(err(400, "VALIDATION_FAILED"));
    expect(attempt.keyFor({ id: "o1" })).not.toBe(k1);
  });

  it("thành công (reset) → lần sau key mới", () => {
    const attempt = createIdempotencyAttempt(sequence());
    const k1 = attempt.keyFor({ id: "o1" });
    attempt.reset();
    expect(attempt.keyFor({ id: "o1" })).not.toBe(k1);
  });

  it("hai lần thử độc lập (hai dialog) không chia key", () => {
    const generate = sequence();
    const a = createIdempotencyAttempt(generate);
    const b = createIdempotencyAttempt(generate);
    expect(a.keyFor({ id: "o1" })).not.toBe(b.keyFor({ id: "o1" }));
  });
});
