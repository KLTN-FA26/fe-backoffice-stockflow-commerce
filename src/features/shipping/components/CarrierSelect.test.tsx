import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CarrierSelect } from "./CarrierSelect";

vi.mock("@/features/shipping/queries", () => ({
  useActiveCarriers: () => ({
    data: {
      items: [
        { carrierId: "car-1", code: "AHAMOVE", name: "Ahamove" },
        { carrierId: "car-2", code: "GHN", name: "Giao Hàng Nhanh" },
      ],
    },
  }),
}));

describe("CarrierSelect — tên hãng, mã chỉ để gõ tìm (R3)", () => {
  it("danh sách chỉ hiện tên hãng, không kèm mã; gõ mã vẫn ra hãng đó", async () => {
    const user = userEvent.setup();
    render(<CarrierSelect id="carrier" value={null} onChange={vi.fn()} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Ahamove" })).toBeInTheDocument();
    expect(screen.queryByText(/AHAMOVE/)).toBeNull();

    await user.keyboard("ghn");
    expect(screen.getByRole("option", { name: "Giao Hàng Nhanh" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ahamove" })).toBeNull();
  });
});
