import { describe, expect, it } from "vitest";

import { beUuid } from "./primitives";

describe("beUuid — id do BE cấp", () => {
  it.each([
    // UUIDv7 của common.id.Identifiers
    "0199f0a2-7c3e-7a1b-8f00-1234567890ab",
    // md5('seed:' || key)::uuid trong BE tools/db/seed/seed_test_data.sql — sai version/variant RFC
    "68dd0ee7-02e7-135e-dce9-cc92509d7a51",
    "a9609637-006a-05a8-6fb0-eb4cb5b18c70",
    "00000000-0000-0000-0000-000000000000",
  ])("chấp nhận %s", (id) => {
    expect(beUuid.safeParse(id).success).toBe(true);
  });

  it.each(["", "abc", "68dd0ee7-02e7-135e-dce9-cc92509d7a5", "68dd0ee702e7135edce9cc92509d7a51"])(
    "từ chối %j",
    (id) => {
      expect(beUuid.safeParse(id).success).toBe(false);
    },
  );
});
