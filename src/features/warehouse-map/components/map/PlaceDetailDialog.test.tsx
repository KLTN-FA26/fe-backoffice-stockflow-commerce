import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { renderWithProviders } from "@/test/render";

import { LAYOUT } from "../../__fixtures__/layout";
import { PlaceDetailDialog } from "./PlaceDetailDialog";

const OPEN_SHELF = UI_LABELS.warehouseMap.print.openShelf;
const [a01, z99] = LAYOUT.shelves;
const rcv = LAYOUT.areas[0];
if (!a01 || !z99 || !rcv) throw new Error("fixture thiếu kệ / khu");

describe("chi tiết kệ — in nhãn cấp kệ (docs 06 §4.3)", () => {
  it("kệ đang dùng: có nút In nhãn kệ", async () => {
    const onPrint = vi.fn();
    renderWithProviders(
      <PlaceDetailDialog
        place={{ kind: "shelf", shelf: a01 }}
        zones={LAYOUT.zones}
        onPrintLabels={onPrint}
        onClose={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: OPEN_SHELF }));
    expect(onPrint).toHaveBeenCalled();
  });

  it("kệ ngừng dùng (BR-17: không có nhãn) và khu vực: không có nút", () => {
    const { unmount } = renderWithProviders(
      <PlaceDetailDialog
        place={{ kind: "shelf", shelf: z99 }}
        zones={LAYOUT.zones}
        onPrintLabels={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: OPEN_SHELF })).not.toBeInTheDocument();
    unmount();
    renderWithProviders(
      <PlaceDetailDialog
        place={{ kind: "area", area: rcv }}
        zones={LAYOUT.zones}
        onPrintLabels={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: OPEN_SHELF })).not.toBeInTheDocument();
  });
});
