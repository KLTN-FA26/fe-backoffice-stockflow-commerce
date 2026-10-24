import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SlideOverPanel } from "./SlideOverPanel";

const content = (props: Partial<React.ComponentProps<typeof SlideOverPanel>> = {}) =>
  render(
    <SlideOverPanel open onClose={() => {}} title="Tiêu đề" {...props}>
      <p>Nội dung</p>
    </SlideOverPanel>,
  );

describe("SlideOverPanel — kích thước và lớp", () => {
  it("mặc định: rộng max-w-md, ở lớp drawer (dưới dialog)", () => {
    content();
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("max-w-md");
    expect(panel.className).toContain("z-[1100]");
  });

  it("size xl: rộng hơn cho khung 3D + bảng", () => {
    content({ size: "xl" });
    const panel = screen.getByRole("dialog");
    expect(panel.className).not.toContain("max-w-md");
    expect(panel.className).toContain("max-w-[min(72rem,100vw)]");
  });

  it("aboveDialogs: nằm trên hộp thoại (mở được từ trong dialog), không còn z-[1100]", () => {
    content({ aboveDialogs: true });
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("z-(--z-dropdown-on-dialog)");
    expect(panel.className).not.toContain("z-[1100]");
  });
});
