import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CYCLE_COUNT_ROUTES } from "@/constants/cycle-count";
import { INVENTORY_ROUTES } from "@/constants/inventory";

// Every Inventory route constant used by links/sidebar must resolve to an App Router page,
// otherwise the link is a 404 (the original /admin/movements defect).
function pageFile(route: string) {
  return path.join(process.cwd(), "src/app", route, "page.tsx");
}

describe("Inventory routes exist in the App Router tree", () => {
  it.each([
    ["movement history", INVENTORY_ROUTES.movements],
    ["adjustment list", INVENTORY_ROUTES.adjustments],
    ["adjustment create", INVENTORY_ROUTES.createAdjustment],
    ["adjustment detail", INVENTORY_ROUTES.adjustment("[id]").replace("%5Bid%5D", "[id]")],
    ["cycle count list", CYCLE_COUNT_ROUTES.list],
    ["cycle count detail", CYCLE_COUNT_ROUTES.detail("[id]").replace("%5Bid%5D", "[id]")],
    ["quarantine decision", INVENTORY_ROUTES.quarantine],
  ])("%s → %s", (_screen, route) => {
    expect(existsSync(pageFile(route))).toBe(true);
  });

  // Kiểm kê trong tab theo kho (spec 2026-11-22) — route group `(operations)` không có trên URL
  it.each([
    ["cycle count list in the workspace", "cycle-counts"],
    ["cycle count detail in the workspace", "cycle-counts/[id]"],
  ])("%s → /admin/warehouse-map/[prefix]/%s", (_screen, rest) => {
    expect(existsSync(pageFile(`admin/warehouse-map/[prefix]/(operations)/${rest}`))).toBe(true);
  });
});
