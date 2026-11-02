import { describe, expect, it } from "vitest";

import { adminCancelFormSchema, creditRejectionFormSchema } from "./form-schemas";

describe("form schemas → Input schemas (pipe)", () => {
  it("huỷ: chuỗi rỗng → bỏ field; % nhập chuỗi → số", () => {
    expect(
      adminCancelFormSchema.parse({ reasonCode: "OUT_OF_STOCK", note: "  ", retainedPercent: "" }),
    ).toEqual({ reasonCode: "OUT_OF_STOCK" });
    expect(
      adminCancelFormSchema.parse({
        reasonCode: "CUSTOMER_REQUEST",
        note: "x",
        retainedPercent: "25",
      }),
    ).toEqual({ reasonCode: "CUSTOMER_REQUEST", note: "x", retainedPercent: 25 });
  });

  it("huỷ: chưa chọn lý do / OTHER thiếu ghi chú → lỗi đúng field", () => {
    const missing = adminCancelFormSchema.safeParse({
      reasonCode: "",
      note: "",
      retainedPercent: "",
    });
    expect(missing.error?.issues[0]?.path).toEqual(["reasonCode"]);
    const other = adminCancelFormSchema.safeParse({
      reasonCode: "OTHER",
      note: "",
      retainedPercent: "",
    });
    expect(other.error?.issues[0]?.path).toEqual(["note"]);
  });

  it("từ chối: chưa chọn cách xử lý → 'Chọn cách xử lý'; % sai → lỗi ở depositPercent", () => {
    const empty = creditRejectionFormSchema.safeParse({
      action: "",
      depositPercent: "",
      note: "x",
    });
    expect(empty.error?.issues[0]?.message).toBe("Chọn cách xử lý");
    const bad = creditRejectionFormSchema.safeParse({
      action: "SWITCH_TO_DEPOSIT",
      depositPercent: "100",
      note: "x",
    });
    expect(bad.error?.issues[0]?.path).toEqual(["depositPercent"]);
  });
});
