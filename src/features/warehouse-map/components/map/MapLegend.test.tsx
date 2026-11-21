import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";

import { renderWithProviders } from "@/test/render";

import { LAYOUT } from "../../__fixtures__/layout";
import { MapLegend } from "./MapLegend";

describe("MapLegend", () => {
  it("giải thích thanh chắn vàng = mặt kệ không lấy hàng (BR-08)", () => {
    renderWithProviders(<MapLegend layout={LAYOUT} />);
    expect(screen.getByText(UI_LABELS.warehouseMap.map.closedFace)).toBeInTheDocument();
  });
});
