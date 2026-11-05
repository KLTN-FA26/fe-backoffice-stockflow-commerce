import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIGHT_SCENE_THEME } from "../../lib/scene-theme";

import { useSceneTheme } from "./useSceneTheme";

const themeState = vi.hoisted(() => ({ theme: "light" as "light" | "dark" }));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: themeState.theme, toggleTheme: () => {} }),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute("style");
  themeState.theme = "light";
});

describe("useSceneTheme", () => {
  it("starts from the light fallback, then reads the tokens one frame later", () => {
    const { result } = renderHook(() => useSceneTheme());
    expect(result.current).toEqual(LIGHT_SCENE_THEME);
    act(() => void vi.advanceTimersToNextFrame());
    expect(result.current).toEqual(LIGHT_SCENE_THEME);
  });

  it("re-reads the tokens when the app theme flips to dark", () => {
    const { result, rerender } = renderHook(() => useSceneTheme());
    act(() => void vi.advanceTimersToNextFrame());
    // ThemeProvider đổi token (data-theme) rồi các con render lại
    document.documentElement.style.setProperty("--bg-subtle", "#1f2124");
    themeState.theme = "dark";
    rerender();
    act(() => void vi.advanceTimersToNextFrame());
    expect(result.current.background).toBe("#1f2124");
  });
});
