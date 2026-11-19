import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_LABELS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { ProductionSchedule } from "../components/schedule/ProductionSchedule";
import { bePage, PRODUCTION_ACTORS, producerDto } from "../__fixtures__/production-order";
import { schedule } from "../__fixtures__/schedule";

const L = PRODUCTION_LABELS.schedule;
const D = PRODUCTION_LABELS.drawUp;

function setup(permissions = PRODUCTION_ACTORS.coordinator, searchParams = "") {
  const spies = mockProductionApi(permissions, {
    get: {
      "/production-schedule": () => schedule(),
      "/producers": () => bePage([producerDto]),
    },
  });
  renderProductionScreen(<ProductionSchedule />, "u-test", searchParams);
  return spies;
}

afterEach(() => vi.restoreAllMocks());

describe("ProductionSchedule (docs 17 §4.12)", () => {
  it("hiện Đơn sản xuất đang mở và đợt giao còn thiếu", async () => {
    setup();
    expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
    expect(screen.getByText("SO-2026-0050")).toBeInTheDocument();
  });

  it("bộ lọc trên URL gửi đúng tham số cho BE", async () => {
    const { get } = setup(
      PRODUCTION_ACTORS.coordinator,
      "?alertsOnly=true&from=2026-12-01&to=2026-12-31",
    );
    await screen.findByText("PRD-20261120-0001");
    const call = get.mock.calls.find(([url]) => url === "/production-schedule");
    expect(call?.[1]).toMatchObject({
      params: { alertsOnly: true, from: "2026-12-01", to: "2026-12-31" },
    });
  });

  it("khoảng ngày ngược → báo lỗi, không gửi khoảng ngày lên BE", async () => {
    const { get } = setup(PRODUCTION_ACTORS.coordinator, "?from=2026-12-31&to=2026-12-01");
    expect(await screen.findByText(L.rangeInvalid)).toBeInTheDocument();
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => url === "/production-schedule")).toBe(true),
    );
    const call = get.mock.calls.find(([url]) => url === "/production-schedule");
    expect(call?.[1]).toMatchObject({ params: { from: undefined, to: undefined } });
  });

  it("Điều phối sản xuất có nút Lập ở đợt còn thiếu", async () => {
    setup(PRODUCTION_ACTORS.coordinator);
    const region = await screen.findByRole("region", { name: new RegExp(D.title) });
    expect(
      within(region).getByRole("button", { name: new RegExp(`^${D.action} SO-2026-0050`) }),
    ).toBeInTheDocument();
  });

  it("Sales Manager xem lịch nhưng không lập Đơn sản xuất", async () => {
    setup(PRODUCTION_ACTORS.salesManager);
    const region = await screen.findByRole("region", { name: new RegExp(D.title) });
    expect(
      within(region).queryByRole("button", { name: new RegExp(`^${D.action} `) }),
    ).not.toBeInTheDocument();
  });
});
