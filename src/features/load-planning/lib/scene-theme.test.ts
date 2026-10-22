import { afterEach, describe, expect, it } from "vitest";

import { LIGHT_SCENE_THEME, readSceneTheme } from "./scene-theme";

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

describe("readSceneTheme", () => {
  it("falls back to the light scene colours when the tokens are not defined", () => {
    expect(readSceneTheme()).toEqual(LIGHT_SCENE_THEME);
  });

  it("follows the app's theme tokens, so a dark theme gives a dark scene", () => {
    const root = document.documentElement;
    root.style.setProperty("--bg-subtle", " #1f2124 ");
    root.style.setProperty("--bg-muted", "#2a2c30");
    root.style.setProperty("--ink-secondary", "#a8aaa3");
    root.style.setProperty("--border-strong", "#3d4045");
    root.style.setProperty("--border-default", "#2e3034");
    expect(readSceneTheme()).toEqual({
      background: "#1f2124",
      shellFill: "#2a2c30",
      shellEdge: "#a8aaa3",
      gridMajor: "#3d4045",
      gridMinor: "#2e3034",
    });
  });

  it("falls back per token when only some are defined", () => {
    document.documentElement.style.setProperty("--bg-subtle", "#1f2124");
    const theme = readSceneTheme();
    expect(theme.background).toBe("#1f2124");
    expect(theme.gridMajor).toBe(LIGHT_SCENE_THEME.gridMajor);
  });
});
