import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELAY_ALERT_LABELS, PRODUCTION_LABELS, STORAGE_KEYS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { ProductionSchedule } from "../components/schedule/ProductionSchedule";
import {
  bePage,
  PRODUCER_ID,
  PRODUCTION_ACTORS,
  producerDto,
} from "../__fixtures__/production-order";
import { schedule, scheduledOrder } from "../__fixtures__/schedule";

import type { mockProductionApi as MockApi } from "@/test/production-screen";
import type { ScheduledProductionOrder } from "../schedule-schemas";

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

function setupRows(productionOrders: ScheduledProductionOrder[]) {
  const spies = mockProductionApi(PRODUCTION_ACTORS.coordinator, {
    get: {
      "/production-schedule": () => schedule({ productionOrders }),
      "/producers": () => bePage([producerDto]),
    },
  });
  renderProductionScreen(<ProductionSchedule />);
  return spies;
}

type GetSpy = ReturnType<typeof MockApi>["get"];
const OTHER = "PRD-20261121-0002";
const scheduleCalls = (get: GetSpy) =>
  get.mock.calls.filter(([url]) => url === "/production-schedule").length;
const lastScheduleParams = (get: GetSpy) =>
  (
    get.mock.calls.filter(([url]) => url === "/production-schedule").at(-1)?.[1] as
      { params?: unknown } | undefined
  )?.params;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

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

  it("lọc kho từ link khi không đọc được danh mục kho → nút lọc kho vẫn hiện, chip X bỏ lọc", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCTION_ACTORS.coordinator, "?warehouseId=wh-000000009");
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    expect(
      within(orders).getByRole("button", { name: `Lọc ${L.column.warehouse}` }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Xoá ${L.warehouseFilter}` }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ warehouseId: undefined }));
  });

  it("search trong cột lọc dòng phía FE, hiện chip, không gọi lại BE", async () => {
    const user = userEvent.setup();
    const { get } = setupRows([scheduledOrder(), scheduledOrder({ id: "po-2", code: OTHER })]);
    await screen.findByText(OTHER);
    const calls = scheduleCalls(get);
    const orders = screen.getByRole("region", { name: new RegExp(L.ordersTitle) });
    await user.click(within(orders).getByRole("button", { name: `Lọc ${L.column.code}` }));
    await user.type(screen.getByRole("textbox", { name: L.columnSearch(L.column.code) }), "0002");
    expect(screen.queryByText("PRD-20261120-0001")).not.toBeInTheDocument();
    expect(screen.getByText(OTHER)).toBeInTheDocument();
    expect(
      screen.getByText(`${L.summaryColumnSearch}: ${L.column.code} “0002”`),
    ).toBeInTheDocument();
    expect(scheduleCalls(get)).toBe(calls);
  });

  it("lọc đơn bán từ link không khớp → header vẫn hiện để chỉnh, chip X trả lại dòng", async () => {
    const user = userEvent.setup();
    setup(PRODUCTION_ACTORS.coordinator, "?order=SO-2026-0050");
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    expect(within(orders).getByText(L.filteredTitle)).toBeInTheDocument();
    expect(
      within(orders).getByRole("button", { name: `Lọc ${L.column.order}` }),
    ).toBeInTheDocument();
    expect(screen.getByText("SO-2026-0050")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryColumnSearch}` }));
    expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
  });

  it("search chính lọc cả đợt còn thiếu (theo SKU)", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("PRD-20261120-0001");
    await user.type(screen.getByRole("textbox", { name: L.searchPlaceholder }), "CUS-BAG-009");
    expect(screen.queryByText("PRD-20261120-0001")).not.toBeInTheDocument();
    expect(screen.getByText("SO-2026-0050")).toBeInTheDocument();
  });

  it("chọn đơn vị sản xuất ở header → gửi producerId cho BE", async () => {
    const user = userEvent.setup();
    const { get } = setup();
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    await user.click(within(orders).getByRole("button", { name: `Lọc ${L.column.producer}` }));
    await user.type(screen.getByPlaceholderText(L.optionSearch), "Minh");
    await user.click(screen.getByRole("option", { name: /IN-MINHPHAT · In Minh Phát/ }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ producerId: PRODUCER_ID }));
  });

  it("bật Chỉ dòng có cảnh báo ở header cột Cờ trễ → gửi alertsOnly cho BE", async () => {
    const user = userEvent.setup();
    const { get } = setup();
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    await user.click(within(orders).getByRole("button", { name: `Lọc ${L.column.alerts}` }));
    await user.click(screen.getByRole("checkbox", { name: L.alertsOnly }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ alertsOnly: true }));
  });

  it("ẩn hiện cột: tắt Kho nhận → cột biến mất, chip Cột hiển thị 9/10, X trả lại", async () => {
    const user = userEvent.setup();
    setup();
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    await screen.findByText("PRD-20261120-0001");
    const warehouseHeader = () =>
      within(orders).queryByRole("columnheader", { name: new RegExp(`^${L.column.warehouse}`) });
    expect(warehouseHeader()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ẩn hiện cột" }));
    await user.click(screen.getByRole("option", { name: L.column.warehouse }));
    expect(warehouseHeader()).not.toBeInTheDocument();
    expect(screen.getByText(`${L.summaryColumns}: 9/10`)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryColumns}` }));
    expect(warehouseHeader()).toBeInTheDocument();
  });

  it("cột đã lưu: bỏ key lạ, luôn giữ cột mã Đơn sản xuất", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.adminProductionScheduleConfig,
      JSON.stringify({ visibleColumns: ["status", "bogus"] }),
    );
    setup();
    const orders = await screen.findByRole("region", { name: new RegExp(L.ordersTitle) });
    await waitFor(() =>
      expect(
        within(orders)
          .getAllByRole("columnheader")
          .map((th) => th.textContent),
      ).toEqual([L.column.code, L.column.status]),
    );
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

  it('chưa có dữ liệu, không lọc → empty "chưa có", không có nút Bỏ bộ lọc', async () => {
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
