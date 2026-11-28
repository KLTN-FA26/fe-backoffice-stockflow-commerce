/**
 * Tạo nhiệm vụ lấy hàng — chọn sẵn khi chỉ một lựa chọn, gõ tìm đơn theo số đơn / tên khách (không dấu cũng được), mở từ
 * đơn thì điền sẵn (S14-4, S14-5, R6).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import {
  IDENTITIES,
  mockFulfillmentApi,
  pickSelectOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import {
  ORDER_ID,
  WAREHOUSE_ID,
  apiTask,
  assignees,
  bePage,
  taskCandidate,
} from "../__fixtures__/task";
import { CreateTaskDialog } from "./assign/CreateTaskDialog";
import { PickingList } from "./TaskList";

import type { TaskCandidate } from "@/features/fulfillment/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { fulfillment } = UI_LABELS;
const OTHER_ORDER_ID = "00000000-0000-4000-8000-0000000000aa";
const second: TaskCandidate = {
  ...taskCandidate,
  orderId: OTHER_ORDER_ID,
  orderNumber: "SO-20261011-000500",
  customerName: "Công ty TNHH Trà Sữa Mây",
};

function mockApi(candidates: TaskCandidate[], people = assignees) {
  return mockFulfillmentApi(
    IDENTITIES.warehouseManager,
    {
      "/fulfillment/tasks": () => bePage([]),
      "/fulfillment/task-candidates": () => bePage(candidates),
      "/fulfillment/assignees": () => people,
    },
    { "/fulfillment/tasks": () => apiTask() },
  );
}

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: fulfillment.action.create });

describe("Tạo nhiệm vụ — chọn sẵn khi chỉ có một lựa chọn (R6)", () => {
  it("một đơn chờ xuất kho + một nhân viên → cả hai đã chọn sẵn, tạo luôn được", async () => {
    const user = userEvent.setup();
    const { post } = mockApi([taskCandidate], [assignees[0] as (typeof assignees)[number]]);
    renderFulfillmentScreen(<CreateTaskDialog warehouseId={WAREHOUSE_ID} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(
        (within(dialog).getByRole("combobox", { name: "Đơn hàng" }) as HTMLInputElement).value,
      ).toContain("SO-20261010-000431"),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Người được gán" })).toHaveTextContent(
        "Hoàng Anh Tuấn",
      ),
    );
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/fulfillment/tasks",
        expect.objectContaining({ orderId: ORDER_ID, assignedUserId: assignees[0]?.userId }),
      ),
    );
  });

  it("nhiều đơn / nhiều người → không chọn thay", async () => {
    mockApi([taskCandidate, second]);
    renderFulfillmentScreen(<CreateTaskDialog warehouseId={WAREHOUSE_ID} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    const order = await within(dialog).findByRole("combobox", { name: "Đơn hàng" });
    expect(order).toHaveValue("");
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Người được gán" })).toBeEnabled(),
    );
    expect(within(dialog).getByRole("combobox", { name: "Người được gán" })).toHaveTextContent(
      "Chọn nhân viên kho",
    );
  });

  it("người nhận hiện sẵn ngay khi mở hộp, không bị khoá tới khi chọn đơn", async () => {
    mockApi([taskCandidate, second]);
    renderFulfillmentScreen(<CreateTaskDialog warehouseId={WAREHOUSE_ID} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("combobox", { name: "Người được gán" })).toBeEnabled(),
    );
  });
});

describe("Tạo nhiệm vụ — ô đơn hàng gõ để tìm (S14-5)", () => {
  async function openAndType(text: string) {
    const user = userEvent.setup();
    mockApi([taskCandidate, second]);
    renderFulfillmentScreen(<CreateTaskDialog warehouseId={WAREHOUSE_ID} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    const box = await within(dialog).findByRole("combobox", { name: "Đơn hàng" });
    await user.click(box);
    await user.type(box, text);
    return { user, dialog };
  }

  it("gõ một phần số đơn → chỉ còn đơn khớp", async () => {
    await openAndType("000500");
    expect(await screen.findByRole("option", { name: /SO-20261011-000500/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /SO-20261010-000431/ })).toBeNull();
  });

  it("gõ tên khách không dấu ('tra sua') vẫn ra 'Trà Sữa Mây'", async () => {
    await openAndType("tra sua");
    expect(await screen.findByRole("option", { name: /Trà Sữa Mây/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Nguyễn Hoài Nam/ })).toBeNull();
  });

  it("không khớp → 'Không có đơn nào khớp'", async () => {
    await openAndType("zzzz");
    expect(await screen.findByText(fulfillment.candidate.noMatch)).toBeInTheDocument();
  });
});

describe("Mở từ chi tiết đơn (?create=<đơn>)", () => {
  it("màn Lấy hàng mở sẵn hộp tạo với đơn đó đã chọn", async () => {
    mockApi([taskCandidate, second]);
    renderFulfillmentScreen(<PickingList />, undefined, `?create=${OTHER_ORDER_ID}`);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(
        (within(dialog).getByRole("combobox", { name: "Đơn hàng" }) as HTMLInputElement).value,
      ).toContain("SO-20261011-000500"),
    );
    // Chọn người rồi tạo — vẫn dùng đúng luồng của hộp
    await pickSelectOption(userEvent.setup(), "Người được gán", /Hoàng Anh Tuấn/);
    expect(submit(dialog)).toBeEnabled();
  });
});
