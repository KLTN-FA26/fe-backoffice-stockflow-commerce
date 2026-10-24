import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PICK_LINE_LABELS as L, PUT_BACK_LABELS } from "@/constants";

import { PICK_LINE_2, PICK_LINE_3, apiPickLines } from "../../__fixtures__/pick-lines";
import { WAREHOUSE_ID, apiTask, apiTaskLines } from "../../__fixtures__/task";
import { toFulfillmentTask } from "../../api";
import { toPickLine } from "../../pick-line-api";
import { PickLinesSection } from "./PickLinesSection";

import type { PickLine } from "../../types";

const task = (pickStatus: "PENDING" | "PICKING" | "CANCELLED") =>
  toFulfillmentTask({ ...apiTask({ pickStatus }), lines: apiTaskLines });
const lines = (statuses: PickLine["status"][]) =>
  apiPickLines()
    .map(toPickLine)
    .map((line, index) => ({ ...line, status: statuses[index] ?? line.status }));

function renderSection(props: Partial<React.ComponentProps<typeof PickLinesSection>> = {}) {
  const onSelect = vi.fn();
  render(
    <PickLinesSection
      task={task("PICKING")}
      lines={lines(["Picked", "Open", "Open"])}
      isPending={false}
      error={null}
      onRetry={() => {}}
      activeLineId={PICK_LINE_2}
      onSelect={onSelect}
      canSelect
      {...props}
    />,
  );
  return { onSelect };
}

describe("PickLinesSection — bảng dòng lấy hàng theo lộ trình", () => {
  it("bảng theo lộ trình, dòng đang làm đánh dấu, tiến độ x/y", () => {
    renderSection();
    expect(screen.getByText(L.progress(1, 3))).toBeInTheDocument();
    const table = screen.getByRole("table", { name: L.sectionTitle });
    expect(within(table).getByText("Đã lấy")).toBeInTheDocument();
    expect(within(table).getAllByText("Chờ lấy")).toHaveLength(2);
    const current = within(table)
      .getAllByRole("row")
      .find((row) => row.getAttribute("aria-current") === "true");
    expect(current).toHaveTextContent("HN-A01-01-02-A");
    // Chưa có dòng thiếu → không có cột SL thiếu
    expect(within(table).queryByRole("columnheader", { name: L.shortColumn })).toBeNull();
  });

  it("có dòng báo thiếu → thêm cột SL thiếu (số căn phải)", () => {
    const withShort = lines(["Picked", "Short", "Open"]).map((line) =>
      line.lineId === PICK_LINE_2 ? { ...line, shortQty: 2 } : line,
    );
    renderSection({ lines: withShort, activeLineId: PICK_LINE_3 });
    const table = screen.getByRole("table", { name: L.sectionTitle });
    expect(within(table).getByRole("columnheader", { name: L.shortColumn })).toBeInTheDocument();
    const shortRow = within(table).getAllByRole("row")[2] as HTMLElement;
    expect(within(shortRow).getByText("Thiếu")).toBeInTheDocument();
  });

  it("dòng huỷ (thiếu đã phân bổ lại) không tính vào tổng tiến độ", () => {
    renderSection({ lines: lines(["Picked", "Cancelled", "Open"]), activeLineId: PICK_LINE_3 });
    expect(screen.getByText(L.progress(1, 2))).toBeInTheDocument();
  });

  it("nút Chọn chỉ ở dòng Open; bấm → onSelect(lineId)", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSection();
    expect(screen.getAllByRole("button", { name: /Chọn dòng/ })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: L.selectLine(3) }));
    expect(onSelect).toHaveBeenCalledWith(PICK_LINE_3);
  });

  it("không xác nhận được (không phải người được gán) → không có nút Chọn", () => {
    renderSection({ canSelect: false });
    expect(screen.queryByRole("button", { name: /Chọn dòng/ })).toBeNull();
  });

  it("ghi chú số dòng in không lấy từ kệ", () => {
    renderSection();
    expect(screen.getByText(L.printLines(1))).toBeInTheDocument();
  });

  it("task Pending chưa có dòng → báo sẽ lập khi bắt đầu lấy hàng", () => {
    renderSection({ task: task("PENDING"), lines: [] });
    expect(screen.getByText(L.notPlanned)).toBeInTheDocument();
  });

  it("task đang lấy mà không có dòng, đơn chỉ có dòng in → câu chỉ có dòng in", () => {
    const printOnly = toFulfillmentTask({
      ...apiTask({ pickStatus: "PICKING" }),
      lines: apiTaskLines.filter((line) => line.printLine),
    });
    renderSection({ task: printOnly, lines: [] });
    expect(screen.getByText(L.printOnly)).toBeInTheDocument();
  });

  it("task huỷ còn dòng đã lấy → báo chờ trả về kệ", () => {
    renderSection({
      task: task("CANCELLED"),
      lines: lines(["Picked", "Cancelled", "Cancelled"]),
      canOpenPutBacks: true,
    });
    expect(screen.getByText(L.awaitingPutBack(1))).toBeInTheDocument();
    // Nối sang hàng đợi trả về kệ, lọc sẵn kho của task
    expect(screen.getByRole("link", { name: PUT_BACK_LABELS.openQueue })).toHaveAttribute(
      "href",
      `/admin/put-backs?warehouse=${WAREHOUSE_ID}`,
    );
  });

  it("không có quyền xem hàng đợi trả về kệ → chỉ có câu báo, không có link", () => {
    renderSection({ task: task("CANCELLED"), lines: lines(["Picked", "Cancelled", "Cancelled"]) });
    expect(screen.getByText(L.awaitingPutBack(1))).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: PUT_BACK_LABELS.openQueue })).toBeNull();
  });

  it("dòng đã trả về kệ → hiện SL và bin đã trả (có thể khác bin lấy ra)", () => {
    const returned = lines(["Put Back", "Cancelled", "Cancelled"]).map((line, index) =>
      index === 0
        ? { ...line, pickedQty: 3, putBackQty: 3, putBackLocationCode: "HN-A02-03-01-A" }
        : line,
    );
    renderSection({ task: task("CANCELLED"), lines: returned });
    expect(screen.getByText(PUT_BACK_LABELS.returnedTo(3, "HN-A02-03-01-A"))).toBeInTheDocument();
  });

  it("lỗi tải → thông báo + Thử lại", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderSection({ lines: undefined, error: new Error("boom"), onRetry });
    expect(screen.getByText(L.loadError)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});
