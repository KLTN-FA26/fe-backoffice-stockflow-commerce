import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { mockApi, renderScreen } from "@/test/api-screen";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { LocationPickMap } from "./LocationPickMap";

import type { TestRole } from "@/test/api-screen";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

const K = UI_LABELS.warehouseMap.pick;

beforeAll(() => {
  // jsdom không có ResizeObserver (đo khung bản đồ + tooltip Radix của thanh zoom)
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Thêm một khu tập kết: bản đồ vẫn vẽ nó, nhưng màn gọi không đưa nó vào `pickable`
const STAGING_AREA = {
  ...LAYOUT.areas[0],
  id: "area-stg",
  code: "STG01",
  type: "STAGING",
  name: "Khu tập kết",
  footprint: { x: 40, y: 20, width: 10, length: 6, rotation: 0 },
  locationId: "loc-stg",
  locationCode: "HCM-STG01",
} as const;
const MAP: WarehouseLayout = { ...LAYOUT, areas: [...LAYOUT.areas, STAGING_AREA] };

function show(
  role: TestRole,
  props: Partial<{ marked: string[]; suggested: string[]; pickable: string[]; value: string }> = {},
) {
  const onPick = vi.fn();
  const spies = mockApi(role, { get: { "/warehouses/wh-hcm/layout": () => MAP } });
  renderScreen(
    <LocationPickMap
      warehouseId="wh-hcm"
      marked={props.marked ?? ["HCM-A01-1-A"]}
      suggested={props.suggested}
      pickable={new Set(props.pickable ?? ["HCM-A01-2-A", "HCM-RCV01"])}
      value={props.value ?? ""}
      onPick={onPick}
    />,
    role,
  );
  return { onPick, spies };
}

const overlay = (map: HTMLElement, tone: "warning" | "positive" | "info") =>
  map.querySelectorAll(`g[aria-hidden] rect.stroke-dot-${tone}`);

describe("LocationPickMap — chọn vị trí trên Kho Map 2D (docs 11 §4.1 bước 1–2)", () => {
  it("đánh dấu kệ / khu đang chứa thùng và vị trí đích đã chọn, kèm chú giải chữ", async () => {
    show("WAREHOUSE_STAFF", { marked: ["HCM-A01-1-A", "HCM-RCV01"], value: "HCM-A01-2-A" });
    const map = await screen.findByRole("region", { name: K.label });
    expect(overlay(map, "warning")).toHaveLength(2);
    expect(overlay(map, "positive")).toHaveLength(1);
    expect(within(map).getByText(K.legendMarked)).toBeVisible();
    expect(within(map).getByText(K.legendPicked)).toBeVisible();
  });

  it("bấm khu chọn được → trả mã khu; khu không có trong danh sách chọn → không trả, nói lý do", async () => {
    const { onPick } = show("WAREHOUSE_STAFF");
    const map = await screen.findByRole("region", { name: K.label });
    await userEvent.click(within(map).getByRole("button", { name: /RCV01/ }));
    expect(onPick).toHaveBeenCalledWith("HCM-RCV01");
    await userEvent.click(within(map).getByRole("button", { name: /STG01/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(within(map).getByText(K.notPickable("HCM-STG01"))).toBeVisible();
  });

  it("bấm kệ → lưới bin: chỉ bin chọn được bấm được, bin đang chứa thùng được nêu", async () => {
    const { onPick } = show("WAREHOUSE_STAFF");
    const map = await screen.findByRole("region", { name: K.label });
    await userEvent.click(within(map).getByRole("button", { name: /Kệ A01/ }));
    const bins = within(map).getByRole("region", { name: K.shelfBins("A01") });
    expect(
      within(bins).getByRole("button", { name: K.bin("HCM-A01-1-A", true, false) }),
    ).toBeDisabled();
    expect(
      within(bins).getByRole("button", { name: K.bin("HCM-A01-1-B", false, false) }),
    ).toBeDisabled();
    await userEvent.click(
      within(bins).getByRole("button", { name: K.bin("HCM-A01-2-A", false, true) }),
    );
    expect(onPick).toHaveBeenCalledWith("HCM-A01-2-A");
  });

  it("đích đang là một bin (gõ / quét mã) → mở sẵn lưới bin của kệ đó, bin được đánh dấu đã chọn", async () => {
    show("WAREHOUSE_STAFF", { value: "HCM-A01-2-A" });
    const bins = await screen.findByRole("region", { name: K.shelfBins("A01") });
    expect(
      within(bins).getByRole("button", { name: K.bin("HCM-A01-2-A", false, true) }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("bin gợi ý: kệ của bin hạng nhất tô đậm, lưới bin nêu số hạng, chú giải chỉ hiện khi có gợi ý", async () => {
    const { onPick } = show("WAREHOUSE_STAFF", {
      suggested: ["HCM-A01-2-A", "HCM-A01-1-B"],
      pickable: ["HCM-A01-2-A", "HCM-A01-1-B"],
    });
    const map = await screen.findByRole("region", { name: K.label });
    // Hai bin cùng kệ A01 → một khung, khung hạng nhất (đậm)
    const marks = overlay(map, "info");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("fill-opacity", "0.24");
    expect(within(map).getByText(K.legendSuggested)).toBeVisible();
    await userEvent.click(within(map).getByRole("button", { name: /Kệ A01/ }));
    const bins = within(map).getByRole("region", { name: K.shelfBins("A01") });
    expect(within(bins).getByText(K.rank(1))).toBeVisible();
    await userEvent.click(
      within(bins).getByRole("button", { name: K.bin("HCM-A01-1-B", false, true, 2) }),
    );
    expect(onPick).toHaveBeenCalledWith("HCM-A01-1-B");
  });

  it("không có gợi ý → không tô xanh, không chú giải gợi ý", async () => {
    show("WAREHOUSE_STAFF");
    const map = await screen.findByRole("region", { name: K.label });
    expect(overlay(map, "info")).toHaveLength(0);
    expect(within(map).queryByText(K.legendSuggested)).not.toBeInTheDocument();
  });

  it("thiếu quyền xem bản đồ (warehouse-locations:READ) → chỉ một dòng nhắc, không gọi API bản đồ", async () => {
    const { spies } = show("PRODUCTION_STAFF");
    await waitFor(() =>
      expect(spies.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.getByText(K.noRead)).toBeVisible();
    expect(screen.queryByRole("region", { name: K.label })).not.toBeInTheDocument();
    expect(spies.get).not.toHaveBeenCalledWith("/warehouses/wh-hcm/layout", expect.anything());
  });
});
