import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELAY_ALERT_LABELS, PRODUCTION_LABELS, STORAGE_KEYS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";
import { clickRowAction, openRowMenu } from "@/test/ui-actions";

import { ProductionSchedule } from "../components/schedule/ProductionSchedule";
import {
  bePage,
  PRODUCER_ID,
  PRODUCTION_ACTORS,
  producerDto,
} from "../__fixtures__/production-order";
import { schedule, scheduledOrder, shortBatch } from "../__fixtures__/schedule";

import type { mockProductionApi as MockApi } from "@/test/production-screen";
import type { ProductionSchedule as ProductionScheduleDto } from "../schedule-schemas";

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

function setupData(
  data: Partial<ProductionScheduleDto>,
  searchParams = "",
  permissions = PRODUCTION_ACTORS.coordinator,
) {
  const spies = mockProductionApi(permissions, {
    get: {
      "/production-schedule": () => schedule(data),
      "/producers": () => bePage([producerDto]),
    },
  });
  renderProductionScreen(<ProductionSchedule />, "u-test", searchParams);
  return spies;
}

type GetSpy = ReturnType<typeof MockApi>["get"];
const OTHER = "PRD-20261121-0002";
const ORDERS_TAB = "?tab=orders";
const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });
/** Bảng của tab đang mở. */
const panel = () => screen.findByRole("tabpanel");
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
  describe("tab theo việc", () => {
    it("Điều phối sản xuất + có đợt cần lập → mở sẵn tab Cần lập, số đếm trên từng tab", async () => {
      setup();
      expect(await screen.findByText("SO-2026-0050")).toBeInTheDocument();
      expect(within(await panel()).getByText(DELAY_ALERT_LABELS.PO_NEEDED)).toBeInTheDocument();
      expect(tab(L.tabs.batches)).toHaveAttribute("aria-selected", "true");
      expect(tab(L.tabs.batches)).toHaveTextContent("1");
      expect(tab(L.tabs.orders)).toHaveTextContent("1");
      expect(screen.queryByText("PRD-20261120-0001")).not.toBeInTheDocument();
    });

    it("không có đợt cần lập → mở sẵn tab Đơn sản xuất đang mở (không mở tab rỗng)", async () => {
      setupData({ shortBatches: [] });
      expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
      expect(tab(L.tabs.orders)).toHaveAttribute("aria-selected", "true");
    });

    it("Sales Manager (không lập được) → mở sẵn tab Đơn sản xuất đang mở", async () => {
      setup(PRODUCTION_ACTORS.salesManager);
      expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
      expect(screen.getByText(DELAY_ALERT_LABELS.AT_RISK)).toBeInTheDocument();
    });

    it("tab nằm đầu trang, trước ô tìm kiếm (tab quyết định toolbar bên dưới)", async () => {
      setup();
      const tablist = await screen.findByRole("tablist", { name: L.pageTitle });
      const search = screen.getByRole("textbox", { name: L.searchPlaceholder });
      expect(
        tablist.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("bấm tab → đổi bảng", async () => {
      const user = userEvent.setup();
      setup();
      await screen.findByText("SO-2026-0050");
      await user.click(tab(L.tabs.orders));
      expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
      expect(screen.queryByText("SO-2026-0050")).not.toBeInTheDocument();
    });
  });

  it("bộ lọc trên URL gửi đúng tham số cho BE", async () => {
    const { get } = setup(
      PRODUCTION_ACTORS.coordinator,
      "?alertsOnly=true&from=2026-12-01&to=2026-12-31",
    );
    await screen.findByText("SO-2026-0050");
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
    await screen.findByText("SO-2026-0050");
    const call = get.mock.calls.find(([url]) => url === "/production-schedule");
    expect(call?.[1]).toMatchObject({ params: { from: undefined, to: undefined } });
    expect(screen.queryByText(L.rangeInvalid)).not.toBeInTheDocument();
  });

  it("lọc kho từ link khi không đọc được danh mục kho → nút lọc kho vẫn hiện, chip X bỏ lọc", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCTION_ACTORS.coordinator, `${ORDERS_TAB}&warehouseId=wh-000000009`);
    expect(
      within(await panel()).getByRole("button", { name: `Lọc ${L.column.warehouse}` }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Xoá ${L.warehouseFilter}` }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ warehouseId: undefined }));
  });

  it("search trong cột lọc dòng phía FE, hiện chip, không gọi lại BE", async () => {
    const user = userEvent.setup();
    const { get } = setupData(
      { productionOrders: [scheduledOrder(), scheduledOrder({ id: "po-2", code: OTHER })] },
      ORDERS_TAB,
    );
    await screen.findByText(OTHER);
    const calls = scheduleCalls(get);
    await user.click(within(await panel()).getByRole("button", { name: `Lọc ${L.column.code}` }));
    await user.type(screen.getByRole("textbox", { name: L.columnSearch(L.column.code) }), "0002");
    expect(screen.queryByText("PRD-20261120-0001")).not.toBeInTheDocument();
    expect(screen.getByText(OTHER)).toBeInTheDocument();
    expect(
      screen.getByText(`${L.summaryColumnSearch}: ${L.column.code} “0002”`),
    ).toBeInTheDocument();
    expect(tab(L.tabs.orders)).toHaveTextContent("1");
    expect(scheduleCalls(get)).toBe(calls);
  });

  it("lọc đơn bán từ link không khớp → header vẫn hiện để chỉnh, chip X trả lại dòng", async () => {
    const user = userEvent.setup();
    setup(PRODUCTION_ACTORS.coordinator, `${ORDERS_TAB}&order=SO-2026-0050`);
    const orders = await panel();
    expect(await within(orders).findByText(L.filteredTitle)).toBeInTheDocument();
    expect(
      within(orders).getByRole("button", { name: `Lọc ${L.column.order}` }),
    ).toBeInTheDocument();
    expect(tab(L.tabs.orders)).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryColumnSearch}` }));
    expect(await screen.findByText("PRD-20261120-0001")).toBeInTheDocument();
  });

  it("search chính lọc cả hai tab (đợt theo SKU)", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("SO-2026-0050");
    await user.type(screen.getByRole("textbox", { name: L.searchPlaceholder }), "CUS-BAG-009");
    expect(screen.getByText("SO-2026-0050")).toBeInTheDocument();
    expect(tab(L.tabs.batches)).toHaveTextContent("1");
    expect(tab(L.tabs.orders)).toHaveTextContent("0");
    // Tab mặc định không nhảy khi gõ tìm
    expect(tab(L.tabs.batches)).toHaveAttribute("aria-selected", "true");
  });

  it("chọn đơn vị sản xuất ở header → gửi producerId cho BE", async () => {
    const user = userEvent.setup();
    const { get } = setup(PRODUCTION_ACTORS.coordinator, ORDERS_TAB);
    await screen.findByText("PRD-20261120-0001");
    await user.click(
      within(await panel()).getByRole("button", { name: `Lọc ${L.column.producer}` }),
    );
    await user.type(screen.getByPlaceholderText(L.optionSearch), "Minh");
    await user.click(screen.getByRole("option", { name: /IN-MINHPHAT · In Minh Phát/ }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ producerId: PRODUCER_ID }));
  });

  it("bật Chỉ dòng có cảnh báo ở header cột Cảnh báo của tab Cần lập → gửi alertsOnly cho BE", async () => {
    const user = userEvent.setup();
    const { get } = setup();
    await screen.findByText("SO-2026-0050");
    await user.click(within(await panel()).getByRole("button", { name: `Lọc ${D.alerts}` }));
    await user.click(screen.getByRole("checkbox", { name: L.alertsOnly }));
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ alertsOnly: true }));
  });

  describe("ẩn hiện cột (tab Đơn sản xuất đang mở)", () => {
    it("tắt Kho nhận → cột biến mất, chip Cột hiển thị 9/10, X trả lại", async () => {
      const user = userEvent.setup();
      setup(PRODUCTION_ACTORS.coordinator, ORDERS_TAB);
      await screen.findByText("PRD-20261120-0001");
      const orders = await panel();
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

    it("tab Cần lập không có công cụ ẩn hiện cột", async () => {
      setup();
      await screen.findByText("SO-2026-0050");
      expect(screen.queryByRole("button", { name: "Ẩn hiện cột" })).not.toBeInTheDocument();
      expect(screen.queryByText(new RegExp(`^${L.summaryColumns}`))).not.toBeInTheDocument();
    });

    it("cột đã lưu: bỏ key lạ, luôn giữ cột mã Đơn sản xuất", async () => {
      window.localStorage.setItem(
        STORAGE_KEYS.adminProductionScheduleConfig,
        JSON.stringify({ visibleColumns: ["status", "bogus"] }),
      );
      setup(PRODUCTION_ACTORS.coordinator, ORDERS_TAB);
      const orders = await panel();
      await waitFor(() =>
        expect(
          within(orders)
            .getAllByRole("columnheader")
            .map((th) => th.textContent),
        ).toEqual([L.column.code, L.column.status]),
      );
    });
  });

  it("Điều phối sản xuất có nút Lập ở đợt còn thiếu", async () => {
    setup(PRODUCTION_ACTORS.coordinator);
    await screen.findByText("SO-2026-0050");
    // Menu "⋯" của đợt còn thiếu có mục lập lệnh sản xuất
    const trigger = within(await panel()).getByRole("button", {
      name: /^Thao tác — SO-2026-0050/,
    });
    const menu = await openRowMenu(userEvent.setup(), trigger.closest("tr") as HTMLElement);
    expect(within(menu).getByRole("button", { name: D.dialogTitle })).toBeEnabled();
  });

  it("Sales Manager xem được tab Cần lập nhưng không có nút Lập", async () => {
    setup(PRODUCTION_ACTORS.salesManager, "?tab=batches");
    await screen.findByText("SO-2026-0050");
    expect(
      within(await panel()).queryByRole("button", { name: /^Thao tác/ }),
    ).not.toBeInTheDocument();
  });

  it('chưa có dữ liệu, không lọc → empty "chưa có" ở cả hai tab, không có nút Bỏ bộ lọc', async () => {
    const user = userEvent.setup();
    setupData({ productionOrders: [], shortBatches: [] });
    expect(await screen.findByText(L.ordersEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.clearFilters })).not.toBeInTheDocument();
    await user.click(tab(L.tabs.batches));
    expect(await screen.findByText(L.batchesEmptyTitle)).toBeInTheDocument();
  });

  it("lọc không ra kết quả → empty khác, Bỏ bộ lọc gọi lại lịch không tham số lọc", async () => {
    const user = userEvent.setup();
    const { get } = setupData({ productionOrders: [], shortBatches: [] }, "?alertsOnly=true");
    const button = await screen.findByRole("button", { name: L.clearFilters });
    expect(screen.queryByText(L.ordersEmptyTitle)).not.toBeInTheDocument();
    await user.click(button);
    await waitFor(() => expect(lastScheduleParams(get)).toMatchObject({ alertsOnly: undefined }));
  });

  describe("mở từ đơn bán (?drawOrder=) — hộp Lập mở sẵn (S11-5)", () => {
    it("đúng một đợt còn thiếu của đơn đó → hộp 'Lập Đơn sản xuất' mở thẳng, không phải bấm 'Lập' ở dòng", async () => {
      setup(PRODUCTION_ACTORS.coordinator, "?tab=batches&drawOrder=so-2");
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(D.dialogDescription("SO-2026-0050", 2))).toBeInTheDocument();
    });

    it("kèm ?drawBatch= → chọn đúng đợt; đợt không có → để danh sách, không mở hộp", async () => {
      setupData(
        {
          shortBatches: [
            shortBatch({ seq: 1, deliveryBatchId: "b-1" }),
            shortBatch({ seq: 2, deliveryBatchId: "b-2" }),
          ],
        },
        "?tab=batches&drawOrder=so-2&drawBatch=2",
      );
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(D.dialogDescription("SO-2026-0050", 2))).toBeInTheDocument();
    });

    it("nhiều đợt cùng đơn mà không chỉ rõ đợt → không đoán, hiện danh sách", async () => {
      setupData(
        {
          shortBatches: [
            shortBatch({ seq: 1, deliveryBatchId: "b-1" }),
            shortBatch({ seq: 2, deliveryBatchId: "b-2" }),
          ],
        },
        "?tab=batches&drawOrder=so-2",
      );
      expect((await screen.findAllByText("SO-2026-0050")).length).toBeGreaterThan(0);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("không có quyền lập → không mở hộp", async () => {
      setup(PRODUCTION_ACTORS.salesManager, "?tab=batches&drawOrder=so-2");
      await screen.findByText("SO-2026-0050");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("hộp Lập Đơn sản xuất — đơn vị sản xuất (S11-4)", () => {
    const producer = (index: number) => ({
      ...producerDto,
      id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`,
      code: `XUONG-${index}`,
      name: `Xưởng In Số ${index}`,
    });

    async function openDrawUp(producers: unknown[]) {
      const user = userEvent.setup();
      mockProductionApi(PRODUCTION_ACTORS.coordinator, {
        get: {
          "/production-schedule": () => schedule(),
          "/producers": () => bePage(producers),
        },
      });
      renderProductionScreen(<ProductionSchedule />, "u-test", "?tab=batches");
      await screen.findByText("SO-2026-0050");
      // Thao tác của dòng nằm trong menu "⋯" (backoffice-erp-ui A6)
      await clickRowAction(user, D.dialogTitle, await panel());
      return { user, dialog: await screen.findByRole("dialog") };
    }

    it("chỉ một đơn vị đang dùng → chọn sẵn, nút Lập mở ngay", async () => {
      const { dialog } = await openDrawUp([producerDto]);
      await waitFor(() =>
        expect(
          within(dialog).getByRole("combobox", { name: new RegExp(D.producer) }),
        ).toHaveTextContent("In Minh Phát"),
      );
      expect(within(dialog).getByRole("button", { name: D.submit })).toBeEnabled();
    });

    it("nhiều đơn vị (≤ 10) → Select không chọn sẵn", async () => {
      const { dialog } = await openDrawUp([producer(1), producer(2)]);
      expect(
        within(dialog).getByRole("combobox", { name: new RegExp(D.producer) }),
      ).toHaveTextContent(PRODUCTION_LABELS.edit.producerPlaceholder);
      expect(within(dialog).getByRole("button", { name: D.submit })).toBeDisabled();
    });

    it("hơn 10 đơn vị → ô gõ để tìm theo mã hoặc tên", async () => {
      const { user, dialog } = await openDrawUp(
        Array.from({ length: 12 }, (_, i) => producer(i + 1)),
      );
      const box = within(dialog).getByRole("combobox", { name: new RegExp(D.producer) });
      await user.click(box);
      await user.type(box, "số 11");
      expect(await screen.findByRole("option", { name: /Xưởng In Số 11/ })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /Xưởng In Số 3\b/ })).toBeNull();
    });
  });
});
