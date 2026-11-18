import { describe, expect, it } from "vitest";

import { mockLoadingSheetPdf } from "./mock-loading-sheet-pdf";

describe("mockLoadingSheetPdf", () => {
  it("là PDF một trang, có mã kế hoạch, số xe và từng mã kiện", async () => {
    const blob = mockLoadingSheetPdf("LP-1", 2, ["LPN-1", "LPN-2"]);
    const text = await blob.text();
    expect(blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Loading sheet LP-1 / vehicle 2");
    expect(text).toContain("(LPN-2)");
    expect(text.match(/\/Type \/Page /g)).toHaveLength(1);
  });
});
