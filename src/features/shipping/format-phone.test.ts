import { describe, expect, it } from "vitest";

import { formatPhone } from "./format-phone";

describe("formatPhone", () => {
  it("turns the carrier's 84… form into the national 0… form, grouped 4-3-3", () => {
    expect(formatPhone("84911111110")).toBe("0911 111 110");
    expect(formatPhone("+84911111110")).toBe("0911 111 110");
    expect(formatPhone("0911111110")).toBe("0911 111 110");
  });
  it("accepts separators already typed", () => {
    expect(formatPhone("0911-111.110")).toBe("0911 111 110");
  });
  it("leaves anything it does not recognise as it was", () => {
    expect(formatPhone("02438251234")).toBe("02438251234");
    expect(formatPhone("ext 12")).toBe("ext 12");
  });
});
