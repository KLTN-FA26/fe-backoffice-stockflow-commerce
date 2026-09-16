/**
 * Tests cho usePageConfig — hook persist config của 6 trang admin.
 *
 * Trọng tâm: hành vi merge (config lưu cũ thiếu field vẫn phải ra config hợp lệ)
 * và không ghi đè localStorage khi mới mount.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePageConfig } from "./use-page-config";

interface TestConfig {
  showStats: boolean;
  globalSearch: { query: string; fields: string[] };
  visibleColumns: string[];
}

const DEFAULT_COLUMNS = ["a", "b", "c"];

const DEFAULT_CONFIG: TestConfig = {
  showStats: false,
  globalSearch: { query: "", fields: ["name"] },
  visibleColumns: DEFAULT_COLUMNS,
};

function merge(stored: Partial<TestConfig>, fallback: TestConfig): TestConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_COLUMNS,
  };
}

const KEY = "stockflow:test:config";

describe("usePageConfig", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("trả về default khi localStorage rỗng", () => {
    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it("KHÔNG ghi localStorage lúc mới mount (chưa ai đổi gì)", () => {
    renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("đọc lại config đã lưu và merge với default", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ showStats: true }));

    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));

    expect(result.current.config.showStats).toBe(true);
    // field thiếu trong bản lưu phải lấy từ default
    expect(result.current.config.globalSearch).toEqual(DEFAULT_CONFIG.globalSearch);
    expect(result.current.config.visibleColumns).toEqual(DEFAULT_COLUMNS);
  });

  it("visibleColumns rỗng trong bản lưu → fallback về default", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ visibleColumns: [] }));

    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));

    expect(result.current.config.visibleColumns).toEqual(DEFAULT_COLUMNS);
  });

  it("JSON hỏng → trả default, không crash", () => {
    window.localStorage.setItem(KEY, "{ khong-phai-json");

    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));

    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it("updateConfig ghi giá trị mới xuống localStorage", () => {
    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));

    act(() => {
      result.current.updateConfig((current) => ({ ...current, showStats: true }));
    });

    expect(result.current.config.showStats).toBe(true);
    const persisted = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as TestConfig;
    expect(persisted.showStats).toBe(true);
  });

  it("setConfig reset về default vẫn persist", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ showStats: true }));
    const { result } = renderHook(() => usePageConfig(KEY, DEFAULT_CONFIG, merge));

    act(() => {
      result.current.setConfig(DEFAULT_CONFIG);
    });

    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    const persisted = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as TestConfig;
    expect(persisted.showStats).toBe(false);
  });
});
