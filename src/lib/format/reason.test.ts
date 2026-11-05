import { describe, expect, it } from "vitest";

import { reasonLength, stripReason } from "./reason";

describe("reason text (matches BE StatusChangeReason)", () => {
  it("trims ASCII and Unicode spaces and the zero-width space", () => {
    expect(stripReason("   abcde  　​")).toBe("abcde");
    expect(reasonLength(" ".repeat(5))).toBe(0);
  });
  it("counts code points, not UTF-16 units", () => {
    expect(reasonLength("\u{1F512}".repeat(5))).toBe(5);
    expect(reasonLength("\u{1F512}".repeat(500))).toBe(500);
    expect("\u{1F512}".repeat(5)).toHaveLength(10);
  });
  it("keeps inner spaces as content", () => {
    expect(reasonLength("a b c")).toBe(5);
  });
});
