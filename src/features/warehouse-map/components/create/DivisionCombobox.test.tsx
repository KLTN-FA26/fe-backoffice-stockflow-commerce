import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DivisionCombobox } from "./DivisionCombobox";

import type { VnDivision } from "@/lib/references/vn-divisions";

const PROVINCES = [
  { code: 1, name: "Thành phố Hà Nội", codename: "ha_noi" },
  { code: 79, name: "Thành phố Hồ Chí Minh", codename: "ho_chi_minh" },
  { code: 74, name: "Tỉnh Bình Dương", codename: "binh_duong" },
  { code: 75, name: "Tỉnh Bình Phước", codename: "binh_phuoc" },
] as VnDivision[];

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

function renderBox(onSelect = vi.fn()) {
  render(
    <DivisionCombobox
      id="province"
      label="Tỉnh / thành phố"
      placeholder="Chọn tỉnh / thành phố"
      value=""
      items={PROVINCES}
      loading={false}
      onSelect={onSelect}
    />,
  );
  return screen.getByRole("combobox", { name: "Tỉnh / thành phố" });
}

describe("DivisionCombobox — lọc ở client", () => {
  it("gõ tắt 'hcm' → ra Thành phố Hồ Chí Minh; Enter chọn", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const box = renderBox(onSelect);
    await user.type(box, "hcm");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Thành phố Hồ Chí Minh",
    ]);
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 79 }));
  });

  it("gõ không dấu theo tên hoặc codename: 'ho chi minh', 'binh duong'", async () => {
    const user = userEvent.setup();
    const box = renderBox();
    await user.type(box, "binh duong");
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Tỉnh Bình Dương");
    await user.clear(box);
    await user.type(box, "ho chi minh");
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Thành phố Hồ Chí Minh");
  });
});
