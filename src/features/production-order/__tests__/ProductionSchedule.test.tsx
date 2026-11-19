import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELAY_ALERT_LABELS, PRODUCTION_LABELS } from "@/constants";
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
  it("hiện Đơn sản xuất đang mở kèm cờ trễ và đợt còn thiếu kèm PO_NEEDED", async () => {
    setup();
    expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
    expect(screen.getByText(DELAY_ALERT_LABELS.AT_RISK)).toBeInTheDocument();
    expect(screen.getByText("SO-2026-0050")).toBeInTheDocument();
    expect(screen.getByText(DELAY_ALERT_LABELS.PO_NEEDED)).toBeInTheDocument();
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

  it("ngày sai định dạng trên URL → không gửi lên BE", async () => {
    const { get } = setup(PRODUCTION_ACTORS.coordinator, "?from=2026-12-1&to=abc");
    await screen.findByText("PRD-20261120-0001");
    const call = get.mock.calls.find(([url]) => url === "/production-schedule");
    expect(call?.[1]).toMatchObject({ params: { from: undefined, to: undefined } });
    expect(screen.queryByText(L.rangeInvalid)).not.toBeInTheDocument();
  });

  it("lọc kho từ link khi không đọc được danh mục kho → vẫn hiện ô lọc kho", async () => {
    setup(PRODUCTION_ACTORS.coordinator, "?warehouseId=wh-000000009");
    await screen.findByText("PRD-20261120-0001");
    expect(screen.getByRole("combobox", { name: L.warehouseFilter })).toBeInTheDocument();
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

  it("chưa có dữ liệu, không lọc → empty \"chưa có\", không có nút Bỏ bộ lọc", async () => {
    mockProductionApi(PRODUCTION_ACTORS.coordinator, {
      get: {
        "/production-schedule": () => schedule({ productionOrders: [], shortBatches: [] }),
        "/producers": () => bePage([producerDto]),
      },
    });
    renderProductionScreen(<ProductionSchedule />);
    expect(await screen.findByText(L.ordersEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(L.batchesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.clearFilters })).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả → empty khác, Bỏ bộ lọc gọi lại lịch không tham số lọc", async () => {
    const user = userEvent.setup();
    const { get } = mockProductionApi(PRODUCTION_ACTORS.coordinator, {
      get: {
        "/production-schedule": () => schedule({ productionOrders: [], shortBatches: [] }),
        "/producers": () => bePage([producerDto]),
      },
    });
    renderProductionScreen(<ProductionSchedule />, "u-test", "?alertsOnly=true");
    const buttons = await screen.findAllByRole("button", { name: L.clearFilters });
    expect(buttons).toHaveLength(2);
    expect(screen.queryByText(L.ordersEmptyTitle)).not.toBeInTheDocument();
    const [first] = buttons;
    if (first) await user.click(first);
    await waitFor(() => {
      const last = get.mock.calls.filter(([url]) => url === "/production-schedule").at(-1);
      expect(last?.[1]).toMatchObject({ params: { alertsOnly: undefined } });
    });
  });
});
