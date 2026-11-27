import { describe, expect, it } from "vitest";

import { roleDisplayName } from "./role-options";

describe("roleDisplayName", () => {
  it("maps BE seed role codes to Vietnamese names", () => {
    expect(roleDisplayName("SYSTEM_ADMIN")).toBe("Quản trị hệ thống");
    expect(roleDisplayName("WAREHOUSE_STAFF")).toBe("Nhân viên kho");
    expect(roleDisplayName("ACCOUNTANT")).toBe("Kế toán");
  });

  it("turns an unknown code into readable words instead of the raw enum", () => {
    expect(roleDisplayName("SHIFT_LEAD")).toBe("Shift lead");
  });

  it("keeps an empty code as-is", () => {
    expect(roleDisplayName("")).toBe("");
  });
});
