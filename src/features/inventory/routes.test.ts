import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
  ])("%s → %s", (_screen, route) => {
    expect(existsSync(pageFile(route))).toBe(true);
  });
});
