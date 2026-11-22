import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  columnSummaryItem,
  columnToolbarProps,
  useColumnVisibility,
} from "./use-column-visibility";

const KEY = "stockflow:test:columns";
const ALL = ["code", "name", "batch", "amount", "actions"] as const;
const OPTIONS = {
  defaults: ["code", "name", "amount", "actions"],
  locked: ["code", "actions"],
} as const;

afterEach(() => localStorage.clear());

describe("useColumnVisibility (data-table-mode-a §4.2)", () => {
  it("starts from the defaults, toggles a column, persists it and resets", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, ALL, OPTIONS));
    expect(result.current.visible).toEqual(["code", "name", "amount", "actions"]);
    expect(result.current.hasColumnConfig).toBe(false);
    // Chip counts data columns only (no actions column): 3 of 4
    expect(columnSummaryItem(result.current).value).toBe("3/4");
    act(() => result.current.toggle("batch"));
    expect(result.current.visible).toEqual(["code", "name", "batch", "amount", "actions"]);
    expect(result.current.hasColumnConfig).toBe(true);
    expect(localStorage.getItem(KEY)).toContain("batch");
    act(() => result.current.reset());
    expect(result.current.visible).toEqual(["code", "name", "amount", "actions"]);
  });

  it("a locked column cannot be hidden", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, ALL, OPTIONS));
    act(() => result.current.toggle("code"));
    expect(result.current.visible).toContain("code");
  });

  it("a stored config drops unknown keys, re-adds locked columns and keeps the original order", () => {
    localStorage.setItem(KEY, JSON.stringify({ visibleColumns: ["amount", "gone", "name"] }));
    const { result } = renderHook(() => useColumnVisibility(KEY, ALL, OPTIONS));
    expect(result.current.visible).toEqual(["code", "name", "amount", "actions"]);
  });

  it("toolbar props list data columns (locked ones included, actions left out)", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, ALL, OPTIONS));
    const props = columnToolbarProps(
      result.current,
      { code: "Mã", name: "Tên", batch: "Đợt", amount: "Tiền", actions: "Thao tác" },
      ALL,
    );
    expect(props.columnOptions.map((option) => option.value)).toEqual([
      "code",
      "name",
      "batch",
      "amount",
    ]);
    expect(props.lockedColumns).toEqual(["code", "actions"]);
  });
});
