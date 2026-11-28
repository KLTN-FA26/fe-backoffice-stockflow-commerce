import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ParcelCode, parcelDisplayCode } from "./ParcelCode";

describe("ParcelCode (docs 08 §4.3 bước 6: mã kiện = LPN)", () => {
  it("có LPN → LPN là mã chính, mã nhãn nhỏ bên dưới", () => {
    render(<ParcelCode lpn="LPN-20261128-000013" labelCode="SO-20261128-000004-C1" />);
    expect(screen.getByText("LPN-20261128-000013")).toBeInTheDocument();
    expect(screen.getByText("SO-20261128-000004-C1")).toBeInTheDocument();
  });

  it("BE cũ chưa trả LPN → chỉ mã nhãn", () => {
    render(<ParcelCode labelCode="SO-1-C1" />);
    expect(screen.getByText("SO-1-C1")).toBeInTheDocument();
  });

  it("parcelDisplayCode: LPN nếu có, không thì mã nhãn", () => {
    expect(parcelDisplayCode({ lpn: "LPN-1", labelCode: "SO-1-C1" })).toBe("LPN-1");
    expect(parcelDisplayCode({ lpn: null, labelCode: "SO-1-C1" })).toBe("SO-1-C1");
  });
});
