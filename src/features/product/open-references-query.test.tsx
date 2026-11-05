import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installApi, renderApp } from "./product-test-utils";
import { useOpenReferences } from "./queries";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const url = `/products/${PRODUCT}/open-references`;

afterEach(() => {
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
});

/** Thẻ luôn hiện (cached) + hộp thoại ngừng kinh doanh (mặc định) dùng chung một khoá. */
function Harness() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const card = useOpenReferences(PRODUCT, true, { cached: true });
  useOpenReferences(PRODUCT, dialogOpen);
  return (
    <>
      <span>{card.data ? `refs:${card.data.references.length}` : "loading"}</span>
      <button type="button" onClick={() => setDialogOpen(true)}>
        open dialog
      </button>
    </>
  );
}

function backToTab() {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

describe("useOpenReferences — thẻ dùng lại dữ liệu, hộp thoại ngừng kinh doanh luôn lấy mới", () => {
  it("thẻ: quay về tab không gọi lại BE; mở hộp thoại thì vẫn gọi lại ngay", async () => {
    const { get } = installApi({
      permissions: [],
      get: (u) => (u === url ? { references: [], truncated: false } : undefined),
    });
    const calls = () => get.mock.calls.filter(([u]) => u === url).length;
    renderApp(<Harness />);
    expect(await screen.findByText("refs:0")).toBeInTheDocument();
    expect(calls()).toBe(1);

    backToTab();
    backToTab();
    // Cho focus listener một nhịp — nếu có refetch thì đã được gọi.
    await act(async () => {});
    expect(calls()).toBe(1);

    await userEvent.setup().click(screen.getByRole("button", { name: "open dialog" }));
    await waitFor(() => expect(calls()).toBe(2));
  });
});
