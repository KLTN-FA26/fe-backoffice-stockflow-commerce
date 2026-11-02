import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useUnsavedGuard } from "./use-unsaved-guard";

const leave = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("useUnsavedGuard", () => {
  it("asks the browser to confirm leaving only while there are unsaved changes", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedGuard(dirty), {
      initialProps: { dirty: false },
    });
    expect(leave()).toBe(false);
    rerender({ dirty: true });
    expect(leave()).toBe(true);
    rerender({ dirty: false });
    expect(leave()).toBe(false);
    rerender({ dirty: true });
    unmount();
    expect(leave()).toBe(false);
  });
});
