import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogScrollArea } from "./DialogScrollArea";

describe("DialogScrollArea", () => {
  it("bọc thân dialog trong vùng cuộn giới hạn chiều cao theo màn hình", () => {
    render(
      <DialogScrollArea>
        <p>Nội dung dài</p>
      </DialogScrollArea>,
    );
    const area = screen.getByText("Nội dung dài").parentElement;
    expect(area).toHaveClass("max-h-[50vh]", "overflow-y-auto");
  });
});
