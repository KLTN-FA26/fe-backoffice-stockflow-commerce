import { describe, expect, it } from "vitest";

import { formatCarrierEventPayload } from "./carrier-event-payload";

describe("formatCarrierEventPayload", () => {
  it("JSON hợp lệ được xuống dòng", () => {
    expect(formatCarrierEventPayload('{"a":1}')).toBe('{\n  "a": 1\n}');
  });
  it("nội dung không phải JSON giữ nguyên", () => {
    const refused = '[refused: 91 bytes, sha256 abc] {"loadCode":"LD-1"}';
    expect(formatCarrierEventPayload(refused)).toBe(refused);
    expect(formatCarrierEventPayload("42")).toBe("42");
  });
  it("trống / vắng → null", () => {
    expect(formatCarrierEventPayload(null)).toBeNull();
    expect(formatCarrierEventPayload(undefined)).toBeNull();
    expect(formatCarrierEventPayload("  ")).toBeNull();
  });
});
