import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES } from "./routes";

describe("ADMIN_ROUTES.products.printConfig", () => {
  it("builds the print configuration page of a variant under its product", () => {
    expect(ADMIN_ROUTES.products.printConfig("PRD-002", "SKU-002-WHT")).toBe(
      "/admin/products/PRD-002/variants/SKU-002-WHT/print-config",
    );
  });
});
