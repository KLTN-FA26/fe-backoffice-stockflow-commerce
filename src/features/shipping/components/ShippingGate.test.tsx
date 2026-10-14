import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

const config = vi.hoisted(() => ({ IS_MOCK: false }));
vi.mock("@/lib/config", () => config);

const { ShippingGate } = await import("./ShippingGate");

describe("ShippingGate — BE SCRUM-288 chưa có API chuyến xe", () => {
  it("nối BE thật (không mock) → 'Đang phát triển', không render màn gọi API", () => {
    config.IS_MOCK = false;
    render(
      <ShippingGate>
        <p>màn xếp xe</p>
      </ShippingGate>,
    );
    expect(screen.getByText(UI_LABELS.shipping.notAvailableYet)).toBeInTheDocument();
    expect(screen.queryByText("màn xếp xe")).not.toBeInTheDocument();
  });

  it("chạy mock → màn xếp xe đầy đủ", () => {
    config.IS_MOCK = true;
    render(
      <ShippingGate>
        <p>màn xếp xe</p>
      </ShippingGate>,
    );
    expect(screen.getByText("màn xếp xe")).toBeInTheDocument();
  });
});
