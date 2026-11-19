import { describe, expect, it } from "vitest";

import { contextStatusLabel } from "../selectors";

// WF-02 audit: the context chips of a conversation showed the BE code ("APPROVED", "DRAFT").
describe("contextStatusLabel", () => {
  it.each([
    ["DESIGN", "APPROVED", "Đã duyệt"],
    ["DESIGN_PROJECT", "ACTIVE", "Đang mở"],
    ["QUOTE", "DRAFT", "Nháp"],
    ["QUOTE", "SENT", "Đã gửi"],
    ["CONTRACT", "SIGNED", "Đã ký"],
    ["ORDER", "PENDING_CONTRACT", "Chờ ký hợp đồng"],
  ])("%s %s → %s", (kind, status, label) => {
    expect(contextStatusLabel(kind, status)).toBe(label);
  });

  it("an unknown code stays as it is", () => {
    expect(contextStatusLabel("PRODUCT", "SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
