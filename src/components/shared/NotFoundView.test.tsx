import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotFoundView } from "./NotFoundView";

const ACTIONS = [{ href: "/admin", label: "Về trang quản trị" }];

describe("NotFoundView", () => {
  it("đứng một mình (fullPage) → vùng chính là <main>", () => {
    render(<NotFoundView fullPage actions={ACTIONS} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Không tìm thấy trang" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang quản trị" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("trong khung quản trị (đã có <main> của khung) → chỉ là vùng, không lồng thêm <main>", () => {
    const { container } = render(<NotFoundView actions={ACTIONS} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(container.querySelector("section")).not.toBeNull();
    expect(container.querySelector("main")).toBeNull();
  });
});
