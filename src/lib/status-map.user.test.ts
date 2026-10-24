import { describe, expect, it } from "vitest";

import { USER_STATUSES } from "@/constants";

import { statusLabelVi, toneOf } from "./status-map";

describe("status-map — BE UserStatus", () => {
  it("gives every account status a Vietnamese label", () => {
    for (const status of USER_STATUSES) expect(statusLabelVi(status)).toBeTruthy();
  });

  it("tones: ACTIVE positive, LOCKED warning, DISABLED muted (never the neutral fallback)", () => {
    expect(toneOf("ACTIVE")).toBe("positive");
    expect(toneOf("LOCKED")).toBe("warning");
    expect(toneOf("DISABLED")).toBe("muted");
  });
});
