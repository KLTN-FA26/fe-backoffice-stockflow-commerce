import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapToolbar } from "./MapToolbar";

import type { MapUrlState } from "./useMapUrlState";

const url = (showInactive: boolean): MapUrlState => ({
  view: "2d",
  selectedId: null,
  showInactive,
  toggleInactive: vi.fn(),
  setView: vi.fn(),
  select: vi.fn(),
});

describe("thanh công cụ bản đồ — vị trí ngừng dùng", () => {
  it("mặc định ẩn; có vị trí ngừng dùng thì có nút bật xem kèm số lượng", async () => {
    const state = url(false);
    render(<MapToolbar url={state} canEdit={false} onEdit={() => {}} inactive={2} />);
    const toggle = screen.getByRole("button", { name: /Hiện vị trí ngừng dùng \(2\)/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(state.toggleInactive).toHaveBeenCalled();
  });

  it("không có vị trí ngừng dùng thì không có nút", () => {
    render(<MapToolbar url={url(false)} canEdit={false} onEdit={() => {}} inactive={0} />);
    expect(screen.queryByRole("button", { name: /ngừng dùng/ })).not.toBeInTheDocument();
  });
});
