import { describe, expect, it } from "vitest";

import { USER_STATUSES } from "@/constants";
import { allowedStatusActions, hasTemporaryLock, USER_TRANSITIONS } from "./lifecycle";

const NOW = new Date("2026-10-23T10:00:00Z");

describe("USER_TRANSITIONS (BE User.lock/unlock/disable/enable)", () => {
  it("covers every status the backend defines", () => {
    expect(Object.keys(USER_TRANSITIONS).sort()).toEqual([...USER_STATUSES].sort());
  });

  it("ACTIVE can be locked or disabled", () => {
    expect(USER_TRANSITIONS.ACTIVE).toEqual(["lock", "disable"]);
  });

  it("LOCKED is unlocked (not enabled) or disabled", () => {
    expect(USER_TRANSITIONS.LOCKED).toEqual(["unlock", "disable"]);
  });

  it("DISABLED can only be enabled — a disabled account cannot be locked (INVALID_USER_STATUS_TRANSITION)", () => {
    expect(USER_TRANSITIONS.DISABLED).toEqual(["enable"]);
  });
});

describe("allowedStatusActions", () => {
  it("offers unlock on an ACTIVE account that is inside a wrong-password lock", () => {
    const user = { status: "ACTIVE", lockedUntil: "2026-10-23T10:10:00Z" } as const;
    expect(hasTemporaryLock(user, NOW)).toBe(true);
    expect(allowedStatusActions(user, NOW)).toEqual(["unlock", "lock", "disable"]);
  });

  it("does not offer unlock once the temporary lock has passed", () => {
    const user = { status: "ACTIVE", lockedUntil: "2026-10-23T09:00:00Z" } as const;
    expect(hasTemporaryLock(user, NOW)).toBe(false);
    expect(allowedStatusActions(user, NOW)).toEqual(["lock", "disable"]);
  });

  it("does not offer unlock twice for an administrator-locked account", () => {
    const user = { status: "LOCKED", lockedUntil: "2026-10-23T10:10:00Z" } as const;
    expect(allowedStatusActions(user, NOW)).toEqual(["unlock", "disable"]);
  });
});
