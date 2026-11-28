import { describe, expect, it } from "vitest";

import { shortageCardName, shortageOptionEffects, suggestedWindowEnd } from "./shortage-card";

describe("suggestedWindowEnd — ngày kết thúc gợi ý khi dời tới ngày dự kiến (D50 DEF)", () => {
  it("giữ độ dài cửa sổ hiện tại (05→10/12 = 5 ngày; dự kiến 22/12 → 27/12)", () => {
    expect(suggestedWindowEnd("2026-12-22", "2026-12-05", "2026-12-10")).toBe("2026-12-27");
  });
  it("qua ranh giới tháng / năm", () => {
    expect(suggestedWindowEnd("2026-12-30", "2026-12-01", "2026-12-04")).toBe("2027-01-02");
  });
  it("thiếu một đầu cửa sổ hiện tại → cửa sổ một ngày", () => {
    expect(suggestedWindowEnd("2026-12-22", null, "2026-12-10")).toBe("2026-12-22");
  });
});

describe("shortageCardName — mã TT-…, không bao giờ UUID", () => {
  it("có mã → mã", () => {
    expect(shortageCardName({ number: "TT-20261128-0001", sentAt: "2026-11-28T03:00:00Z" })).toBe(
      "TT-20261128-0001",
    );
  });
  it("chưa có mã (BE cũ) → 'Thẻ thiếu thùng ngày dd/MM/yyyy'", () => {
    expect(shortageCardName({ number: null, sentAt: "2026-11-28T03:00:00Z" })).toBe(
      "Thẻ thiếu thùng ngày 28/11/2026",
    );
  });
});

describe("shortageOptionEffects — hệ quả từng hướng", () => {
  const card = { missingCartons: 2, batch: { seq: 1, moved: false } };
  it("chờ sản xuất sau cửa sổ → ngày dự kiến + đồng ý dời lịch", () => {
    const lines = shortageOptionEffects(
      { option: "WAIT_FOR_PRODUCTION", expectedDeliveryDate: "2026-12-22", afterWindow: true },
      card,
    );
    expect(lines).toEqual([
      "Dự kiến giao từ 22/12/2026.",
      "Chọn hướng này là đồng ý dời lịch giao tới ngày đó.",
    ]);
  });
  it("giao một phần → các đợt sau cũng bị đóng", () => {
    const lines = shortageOptionEffects(
      { option: "SHIP_PART_CLOSE_REST", amountReduced: 12650000, laterBatchesClosed: [2, 3] },
      card,
    );
    expect(lines.join(" ")).toContain("đợt 2, 3");
  });
  it("huỷ đơn có thể có phí → nêu phí theo thoả thuận", () => {
    const lines = shortageOptionEffects(
      { option: "CANCEL_ORDER", refundUpTo: 30000000, feePossible: true },
      card,
    );
    expect(lines.at(-1)).toBe("Phí (nếu có) theo thoả thuận với Sale.");
  });
});
