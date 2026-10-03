import { describe, expect, it } from "vitest";

import { toProductApiPage, toProductUiPage } from "./pagination";

describe("product page boundary", () => {
  it("maps the first UI page to backend page zero", () => {
    expect(toProductApiPage(1)).toBe(0);
    expect(toProductUiPage(0)).toBe(1);
  });

  it("maps later pages exactly once and clamps invalid input", () => {
    expect(toProductApiPage(7)).toBe(6);
    expect(toProductUiPage(6)).toBe(7);
    expect(toProductApiPage(0)).toBe(0);
  });
});
