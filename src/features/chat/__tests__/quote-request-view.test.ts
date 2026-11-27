import { describe, expect, it } from "vitest";

import { quoteRequestView } from "../selectors";

import type { ChatCard } from "../schemas";

const card = (payload: Record<string, unknown>) => ({ payload }) as unknown as ChatCard;

describe("quoteRequestView: project request card (BE #451)", () => {
  it("reads 'approved x/y', each line's return reason and the close reason", () => {
    const view = quoteRequestView(
      card({
        scope: "PROJECT",
        projectName: "Bộ ly Tết",
        status: "CLOSED",
        approvedCount: 1,
        lineCount: 2,
        closeReason: "Khách chưa sửa",
        lines: [
          { designName: "Ly A", cartons: 10, designStatus: "APPROVED" },
          { designName: "Ly B", cartons: 5, designStatus: "DRAFT", returnReason: "Logo sát mép" },
        ],
      }),
    );
    expect(view).toMatchObject({ approvedCount: 1, lineCount: 2, closeReason: "Khách chưa sửa" });
    expect(view.lines[1]?.returnReason).toBe("Logo sát mép");
  });

  it("counts the lines when an older card has no lineCount, and has no x/y for a design card", () => {
    const project = quoteRequestView(
      card({
        scope: "PROJECT",
        lines: [{ designName: "Ly A", cartons: 1, designStatus: "DRAFT" }],
      }),
    );
    expect(project).toMatchObject({ approvedCount: null, lineCount: 1 });
    expect(quoteRequestView(card({ designName: "Ly A", cartons: 3 }))).toMatchObject({
      approvedCount: null,
      lineCount: null,
    });
  });
});
