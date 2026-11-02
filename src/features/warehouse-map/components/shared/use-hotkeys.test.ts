import { describe, expect, it } from "vitest";

import { comboOf } from "./use-hotkeys";

const press = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
  comboOf(new KeyboardEvent("keydown", { key, ...mods }));

describe("tên tổ hợp phím", () => {
  it("Ctrl (Windows) và ⌘ (macOS) đều là mod", () => {
    expect(press("s", { ctrlKey: true })).toBe("mod+s");
    expect(press("s", { metaKey: true })).toBe("mod+s");
    expect(press("Z", { ctrlKey: true, shiftKey: true })).toBe("mod+shift+z");
  });

  it("ký tự cần Shift để gõ (?, +) không kèm shift; chữ và phím đặc biệt thì có", () => {
    expect(press("?", { shiftKey: true })).toBe("?");
    expect(press("+", { shiftKey: true })).toBe("+");
    expect(press("Tab", { shiftKey: true })).toBe("shift+tab");
    expect(press("ArrowLeft", { shiftKey: true })).toBe("shift+arrowleft");
  });
});
