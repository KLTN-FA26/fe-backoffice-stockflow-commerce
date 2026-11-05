import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RefetchBar } from "./RefetchBar";

describe("RefetchBar", () => {
  it("đang tải lại nền → hiện thanh progress có nhãn cho screen reader", () => {
    render(<RefetchBar active label="Đang tải lại danh sách" />);
    expect(screen.getByRole("progressbar", { name: "Đang tải lại danh sách" })).toBeInTheDocument();
  });

  it("không tải → không chiếm chỗ, không có progressbar", () => {
    render(<RefetchBar active={false} label="Đang tải lại danh sách" />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
