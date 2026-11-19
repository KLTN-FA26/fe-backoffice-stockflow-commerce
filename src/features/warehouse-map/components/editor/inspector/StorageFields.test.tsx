import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";
import { DEFAULT_SHELF_BUILD, draftFromLayout } from "@/features/warehouse-map/draft";

import { renderWithProviders } from "@/test/render";

import { AreaFields } from "./AreaFields";
import { BinGridFields } from "./BinGridFields";

/**
 * BE bỏ storage class khỏi domain kho và tính sức chứa bin theo thể tích (kltn-docs 06, 2026-11-05; 06 BR-19):
 * panel thông số không còn ô lớp lưu trữ hay sức chứa theo đơn vị — chỉ còn tải trọng và cờ lấy / cất hàng.
 */
const E = UI_LABELS.warehouseMap.editor;
const UNLOCKED = { identity: false, geometry: false, remove: false };
const draft = draftFromLayout(LAYOUT);

describe("panel thông số — không còn lớp lưu trữ / sức chứa theo đơn vị", () => {
  it("khu chứa hàng: có tải trọng, không có lớp lưu trữ hay sức chứa", () => {
    const area = draft.items.find((item) => item.kind === "area");
    if (area?.kind !== "area") throw new Error("thiếu khu vực trong fixture");
    renderWithProviders(<AreaFields area={area} issues={{}} locks={UNLOCKED} onPatch={vi.fn()} />);
    expect(screen.getByLabelText(E.maxWeight)).toBeInTheDocument();
    expect(screen.queryByLabelText(/lớp lưu trữ/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/sức chứa/i)).not.toBeInTheDocument();
  });

  it("lưới bin tự sinh: có tải trọng, không có sức chứa", () => {
    const shelf = draft.items.find((item) => item.kind === "shelf");
    if (shelf?.kind !== "shelf") throw new Error("thiếu kệ trong fixture");
    renderWithProviders(
      <BinGridFields shelf={shelf} build={DEFAULT_SHELF_BUILD} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(E.maxWeight)).toBeInTheDocument();
    expect(screen.queryByLabelText(/sức chứa/i)).not.toBeInTheDocument();
  });
});
