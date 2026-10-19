import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRODUCT_STATUS } from "@/constants";

import { ProductLifecycleCard } from "./ProductLifecycleCard";

import type { ProductStatus } from "@/features/product";

const CURRENT = "Hiện tại";

function steps(status: ProductStatus) {
  render(<ProductLifecycleCard status={status} />);
  return within(screen.getByRole("list")).getAllByRole("listitem");
}
const names = (items: HTMLElement[]) =>
  items.map((item) => item.textContent?.replace(CURRENT, "").trim());
const current = (items: HTMLElement[]) =>
  items.find((item) => item.getAttribute("aria-current") === "step");

describe("ProductLifecycleCard — dòng thời gian vòng đời, nhãn tiếng Việt", () => {
  it("hiện nhãn tiếng Việt theo status-map, không lộ trạng thái tiếng Anh của BE", () => {
    const items = steps(PRODUCT_STATUS.APPROVED);
    expect(names(items)).toEqual([
      "Nháp",
      "Chờ duyệt",
      "Đã duyệt",
      "Đã xuất bản",
      "Ngừng kinh doanh",
    ]);
    expect(document.body).not.toHaveTextContent(/Pending Approval|Published|Approved|Draft/);
  });

  it("đánh dấu bước hiện tại (aria-current) kèm nhãn Hiện tại", () => {
    const step = current(steps(PRODUCT_STATUS.PUBLISHED));
    expect(step).toHaveTextContent("Đã xuất bản");
    expect(step).toHaveTextContent(CURRENT);
  });

  it("Ngừng kinh doanh: bỏ bước Đã xuất bản (BE không trả mốc xuất bản — không biết từng xuất bản chưa)", () => {
    const items = steps(PRODUCT_STATUS.DISCONTINUED);
    expect(names(items)).toEqual(["Nháp", "Chờ duyệt", "Đã duyệt", "Ngừng kinh doanh"]);
    expect(current(items)).toHaveTextContent("Ngừng kinh doanh");
  });

  it("Tạm ngưng: bước Tạm ngưng (nhãn riêng của sản phẩm) là hiện tại", () => {
    const items = steps(PRODUCT_STATUS.INACTIVE);
    expect(names(items)).toContain("Tạm ngưng");
    expect(current(items)).toHaveTextContent("Tạm ngưng");
  });
});
