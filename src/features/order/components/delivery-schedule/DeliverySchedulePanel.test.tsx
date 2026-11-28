/**
 * Panel "Lịch giao" trên chi tiết đơn (docs 17 §4.5, §5.5, BR-28): hiển thị đợt giao + cửa sổ hiệu lực + thùng theo SKU +
 * lịch sử dời; action-gating "Dời cửa sổ giao" theo trạng thái đợt + mã quyền BE (`sales-order-delivery-batches:READ` / `sales-contracts:UPDATE`);
 * form dời kiểm BR-28 trước khi gửi; lý do BE từ chối bằng tiếng Việt.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { storageClient } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";
import { openDatePicker, pickDate } from "@/test/date-picker";

import { formatWindowRange } from "../../delivery-window-rules";
import { apiOrder } from "../../__fixtures__/order";
import { pickOrderSelectOption } from "../../__fixtures__/render";
import {
  BATCH_1,
  BATCH_2,
  CONSENT_MESSAGE,
  SCHEDULE_PATH,
  WF4_PERMISSION_SETS,
  apiBatch,
  apiSchedule,
  callsTo,
  inDays,
  renderWf4Detail,
} from "../../__fixtures__/wf4";

import type { PermissionCode } from "@/lib/auth";
import { openOrderDetailTabInFile } from "../../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const WINDOW_PATH = (batchId: string) => `${SCHEDULE_PATH}/${batchId}/window-change`;
const UPLOAD_ID = "u-1";
/** `api.post` answers the evidence upload slot as the BE does, and everything else with `result` (or throws it). */
function mockPost(result: unknown) {
  vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
  return vi.spyOn(api, "post").mockImplementation(async (url: string) => {
    if (url.endsWith("/evidence/uploads"))
      return {
        data: {
          uploadId: UPLOAD_ID,
          method: "PUT",
          url: `https://bucket.s3.amazonaws.com/incoming/${UPLOAD_ID}`,
          headers: { "Content-Type": "application/pdf" },
          expiresAt: "2026-11-12T10:15:00Z",
        },
      };
    if (result instanceof Error) throw result;
    return { data: result };
  });
}
/** Evidence is a file only (S06-9): pick one and wait until it is uploaded. */
async function attachEvidence(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.upload(
    within(dialog).getByLabelText("Tệp bằng chứng"),
    new File(["abc"], "xac-nhan.pdf", { type: "application/pdf" }),
  );
  await within(dialog).findByText(/Đã tải lên: xac-nhan\.pdf/);
}
const KEY = { headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } };
const apiError = (status: number, code: string) =>
  new ApiError(status, code, "English server message", undefined, "trace-1");

const TWO_BATCHES = () =>
  apiSchedule([
    apiBatch(),
    apiBatch({
      batchId: BATCH_2,
      seq: 2,
      contractWindowStart: inDays(30),
      contractWindowEnd: inDays(34),
      windowStart: inDays(30),
      windowEnd: inDays(34),
      state: "AWAITING_STOCK",
      releasedAt: undefined,
      lines: [{ orderLineId: "l-2", sku: "MUG-RED", cartons: 6, heldCartons: 2 }],
    }),
  ]);

async function renderSchedule(
  permissions: readonly PermissionCode[] = WF4_PERMISSION_SETS.sales,
  schedule: () => unknown = TWO_BATCHES,
) {
  const spy = await renderWf4Detail(permissions, { [SCHEDULE_PATH]: schedule });
  return { spy, user: userEvent.setup() };
}

const panel = async () => await screen.findByRole("region", { name: "Lịch giao" });

// Các khối được kiểm nằm ở tab "delivery" của trang chi tiết đơn (`OrderDetailTabs`)
openOrderDetailTabInFile("delivery");

describe("Lịch giao — hiển thị (docs 17 §5.5)", () => {
  it("đợt giao: cửa sổ hiệu lực, trạng thái hiển thị, đã release hay chưa, thùng theo SKU (đã giữ / cần)", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.salesReadOnly);
    const card = await panel();
    expect(within(card).getByText("Hợp đồng HD-0001")).toBeInTheDocument();
    expect(within(card).getByText("Đợt 1")).toBeInTheDocument();
    expect(within(card).getByText("Đợt 2")).toBeInTheDocument();
    expect(within(card).getByText("Sẵn sàng")).toBeInTheDocument(); // Ready
    expect(within(card).getByText("Chờ hàng")).toBeInTheDocument(); // Awaiting Stock
    expect(within(card).getByText(formatWindowRange(inDays(10), inDays(14)))).toBeInTheDocument();
    expect(within(card).getByText(/Đã có lệnh xuất kho/)).toBeInTheDocument();
    expect(within(card).getByText("Chưa có lệnh xuất kho")).toBeInTheDocument();
    expect(within(card).getByText("TSHIRT-WHT-M")).toBeInTheDocument();
    expect(within(card).getByText("4/4 thùng đã giữ")).toBeInTheDocument();
    expect(within(card).getByText("MUG-RED")).toBeInTheDocument();
    expect(within(card).getByText("2/6 thùng đã giữ")).toBeInTheDocument();
  });

  it("đủ năm trạng thái hiển thị của docs §5.5 có nhãn Việt + mã nguyên văn trong tooltip", async () => {
    const states = [
      ["AWAITING_STOCK", "Chờ hàng", "Awaiting Stock"],
      ["READY", "Sẵn sàng", "Ready"],
      ["IN_DELIVERY", "Đang giao", "In Delivery"],
      ["DELIVERED", "Đã giao", "Delivered"],
      ["CLOSED", "Đã đóng", "Closed"],
    ] as const;
    await renderSchedule(WF4_PERMISSION_SETS.salesReadOnly, () =>
      apiSchedule(
        states.map(([state], index) => apiBatch({ batchId: `b-${index}`, seq: index + 1, state })),
      ),
    );
    const card = await panel();
    for (const [, label, code] of states) {
      expect(within(card).getByText(label).closest("[title]")).toHaveAttribute(
        "title",
        `${label} — ${code}`,
      );
    }
  });

  it("đợt đã dời: chip 'Đã dời', cửa sổ hợp đồng, lịch sử (cũ → mới, lý do, ghi chú, bằng chứng tin nhắn, thời điểm)", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.salesReadOnly, () =>
      apiSchedule([
        apiBatch({
          contractWindowStart: inDays(10),
          contractWindowEnd: inDays(14),
          windowStart: inDays(20),
          windowEnd: inDays(23),
          windowChanges: [
            {
              id: "w-1",
              oldStart: inDays(10),
              oldEnd: inDays(14),
              newStart: inDays(20),
              newEnd: inDays(23),
              reason: "SELLER_DELAY",
              note: "Xưởng in trễ một tuần",
              evidenceMessageId: CONSENT_MESSAGE,
              changedBy: "5b1c0a52-9d3e-4a54-8f1f-0d6f7b8a9c01",
              changedByName: "Nguyễn Hải Yến",
              changedAt: "2026-11-11T08:00:00Z",
            },
            {
              id: "w-2",
              oldStart: inDays(5),
              oldEnd: inDays(6),
              newStart: inDays(10),
              newEnd: inDays(14),
              reason: "CUSTOMER_REQUEST",
              evidenceFileName: "xac-nhan.pdf",
              // BE chỉ có id (không có tên): không hiện gì thêm, tuyệt đối không hiện id thô
              changedBy: "7c2d1b63-0e4f-4b65-9a20-1e7a8c9b0d12",
            },
          ],
        }),
      ]),
    );
    const card = await panel();
    expect(within(card).getByText("Đã dời")).toBeInTheDocument();
    expect(within(card).getByText(formatWindowRange(inDays(20), inDays(23)))).toBeInTheDocument();
    expect(
      within(card).getByText(`Theo hợp đồng: ${formatWindowRange(inDays(10), inDays(14))}`),
    ).toBeInTheDocument();
    expect(within(card).getByText("Lịch sử dời cửa sổ")).toBeInTheDocument();
    expect(
      within(card).getByText(
        `${formatWindowRange(inDays(10), inDays(14))} → ${formatWindowRange(inDays(20), inDays(23))}`,
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText(/Bên bán giao trễ/)).toBeInTheDocument();
    expect(within(card).getByText("Xưởng in trễ một tuần")).toBeInTheDocument();
    expect(
      within(card).getByText(`Tin nhắn chat của khách (${CONSENT_MESSAGE})`),
    ).toBeInTheDocument();
    expect(within(card).getByText(/Khách xin dời/)).toBeInTheDocument();
    expect(within(card).getByText("Tệp: xac-nhan.pdf")).toBeInTheDocument();
    // Người dời (docs 17 BR-28): có tên thì hiện "· bởi <tên>"; thiếu tên thì không hiện, không lộ id
    expect(within(card).getByText(/· bởi Nguyễn Hải Yến/)).toBeInTheDocument();
    expect(within(card).getAllByText(/bởi /)).toHaveLength(1);
    expect(card.textContent).not.toContain("5b1c0a52");
    expect(card.textContent).not.toContain("7c2d1b63");
  });

  it("đợt chưa dời không có chip 'Đã dời' / lịch sử; đợt trễ có cờ 'Trễ'", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.salesReadOnly, () =>
      apiSchedule([apiBatch({ late: true }), apiBatch({ batchId: BATCH_2, seq: 2 })]),
    );
    const card = await panel();
    expect(within(card).queryByText("Đã dời")).not.toBeInTheDocument();
    expect(within(card).queryByText("Lịch sử dời cửa sổ")).not.toBeInTheDocument();
    expect(within(card).getAllByText("Trễ")).toHaveLength(1);
  });

  it("đơn không có lịch giao (batches rỗng) → không chiếm chỗ; lỗi tải → báo nhẹ trong panel", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.sales, () => apiSchedule([]));
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(SCHEDULE_PATH, expect.anything()));
    expect(screen.queryByRole("region", { name: "Lịch giao" })).not.toBeInTheDocument();
    vi.restoreAllMocks();
    // Gỡ trang đầu đúng cách (không xoá DOM tay — portal của menu "⋯" trên header còn đang dựng)
    cleanup();
    await renderSchedule(WF4_PERMISSION_SETS.sales, () => {
      throw apiError(500, "INTERNAL_ERROR");
    });
    expect(
      await screen.findByText("Không tải được lịch giao của đơn.", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});

describe("Dời cửa sổ giao — action-gating theo mã quyền BE (≥ 3 vai) và trạng thái đợt", () => {
  it("Sale (sales-contracts:UPDATE): nút 'Dời cửa sổ giao' ở mỗi đợt chưa bàn giao (Sẵn sàng / Chờ hàng)", async () => {
    await renderSchedule();
    const card = await panel();
    expect(within(card).getAllByRole("button", { name: "Dời cửa sổ giao" })).toHaveLength(2);
    expect(within(card).queryByText(/Chỉ Sale/)).not.toBeInTheDocument();
  });

  it("chỉ đọc hợp đồng (sales-contracts:READ — Kế toán / Sale chỉ xem) → thấy lịch nhưng KHÔNG có nút, có giải thích", async () => {
    for (const permissions of [WF4_PERMISSION_SETS.salesReadOnly, WF4_PERMISSION_SETS.accountant]) {
      await renderSchedule(permissions);
      const card = await panel();
      expect(
        within(card).queryByRole("button", { name: "Dời cửa sổ giao" }),
      ).not.toBeInTheDocument();
      expect(
        within(card).getByText(/Chỉ nhân viên Sale mới đổi được cửa sổ giao/),
      ).toBeInTheDocument();
      vi.restoreAllMocks();
      document.body.innerHTML = "";
    }
  });

  it("quản lý kho (sales-order-delivery-batches:READ, BE PR #317; không có sales-contracts:READ / :UPDATE) → thấy lịch nhưng KHÔNG có nút dời", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.warehouseManager);
    const card = await panel();
    expect(within(card).queryByRole("button", { name: "Dời cửa sổ giao" })).not.toBeInTheDocument();
    expect(
      within(card).getByText(/Chỉ nhân viên Sale mới đổi được cửa sổ giao/),
    ).toBeInTheDocument();
  });

  it("không có sales-order-delivery-batches:READ (kể cả khi đọc được hợp đồng) → không hiện panel và KHÔNG gọi API lịch giao", async () => {
    const { spy } = await renderSchedule([
      ORDER_PERMISSIONS.viewPage,
      ORDER_PERMISSIONS.read,
      SALES_CONTRACT_PERMISSIONS.read,
    ]);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByRole("region", { name: "Lịch giao" })).not.toBeInTheDocument();
    expect(callsTo(spy, SCHEDULE_PATH)).toBe(0);
  });

  it("đợt đã bàn giao / đã giao / đã đóng / trạng thái lạ → không có nút (BR-28); Sale thấy lý do khoá", async () => {
    await renderSchedule(WF4_PERMISSION_SETS.sales, () =>
      apiSchedule(
        ["IN_DELIVERY", "DELIVERED", "CLOSED", "SOMETHING_NEW"].map((state, index) =>
          apiBatch({ batchId: `b-${index}`, seq: index + 1, state }),
        ),
      ),
    );
    const card = await panel();
    expect(within(card).queryByRole("button", { name: "Dời cửa sổ giao" })).not.toBeInTheDocument();
    expect(within(card).getAllByText(/không dời được/)).toHaveLength(4);
    expect(within(card).getByText("Không rõ")).toBeInTheDocument();
  });
});

describe("Dời cửa sổ giao — form kiểm BR-28 rồi gửi đúng WindowChangeRequest", () => {
  async function openDialog(batchIndex = 1) {
    const { spy, user } = await renderSchedule();
    const card = await panel();
    await user.click(
      within(card).getAllByRole("button", { name: "Dời cửa sổ giao" })[batchIndex] as HTMLElement,
    );
    return { spy, user, dialog: await screen.findByRole("dialog") };
  }

  async function fillValid(
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    start = inDays(40),
    end = inDays(43),
  ) {
    await pickDate(user, within(dialog).getByLabelText(/^Từ ngày/), start);
    await pickDate(user, within(dialog).getByLabelText(/^Đến ngày/), end);
    await pickOrderSelectOption(user, /Lý do/, /Bên bán giao trễ/);
    await user.type(within(dialog).getByRole("textbox", { name: /Ghi chú/ }), "  Xưởng in trễ  ");
    await attachEvidence(user, dialog);
  }

  it("mô tả nói rõ đợt + đơn, gợi ý cửa sổ hiện hành; nút gửi khoá tới khi form hợp lệ", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveTextContent(`Dời cửa sổ giao của đợt 2 (đơn ${apiOrder.orderNumber})`);
    expect(dialog).toHaveTextContent(
      `Cửa sổ hiện hành: ${formatWindowRange(inDays(30), inDays(34))}`,
    );
    expect(within(dialog).getByRole("button", { name: "Dời cửa sổ giao" })).toBeDisabled();
  });

  it("form hợp lệ → POST đúng path + body (chỉ evidenceUploadId, ghi chú đã trim) + Idempotency-Key; đóng hộp thoại", async () => {
    const post = mockPost(TWO_BATCHES());
    const { user, dialog } = await openDialog();
    await fillValid(user, dialog);
    const submit = within(dialog).getByRole("button", { name: "Dời cửa sổ giao" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        WINDOW_PATH(BATCH_2),
        {
          windowStart: inDays(40),
          windowEnd: inDays(43),
          reasonCode: "SELLER_DELAY",
          note: "Xưởng in trễ",
          evidenceUploadId: UPLOAD_ID,
        },
        KEY,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("BR-28 giữ thứ tự: dời đợt 1 qua ngày bắt đầu đợt 2 → báo đợt 2, chặn gửi, KHÔNG gọi API", async () => {
    const post = mockPost(TWO_BATCHES());
    const { user, dialog } = await openDialog(0);
    await fillValid(user, dialog, inDays(35), inDays(36));
    expect(
      await within(dialog).findByText(/Đợt 2 sẽ bắt đầu trước đợt đứng trước nó/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dời cửa sổ giao" })).toBeDisabled();
    expect(post).not.toHaveBeenCalledWith(
      WINDOW_PATH(BATCH_1),
      expect.anything(),
      expect.anything(),
    );
  });

  it("lịch khoá các ngày trong quá khứ (BR-28: cửa sổ mới không ở quá khứ)", async () => {
    const { user, dialog } = await openDialog();
    await openDatePicker(user, within(dialog).getByLabelText(/^Từ ngày/));
    const grid = await screen.findByRole("grid");
    const disabled = within(grid)
      .getAllByRole("gridcell")
      .filter((cell) => cell.querySelector("button")?.hasAttribute("disabled"));
    expect(disabled.length).toBeGreaterThan(0);
  });

  it("chọn ngày kết thúc rồi dời ngày bắt đầu qua nó → báo 'Ngày kết thúc không được trước ngày bắt đầu'", async () => {
    const { user, dialog } = await openDialog();
    await pickDate(user, within(dialog).getByLabelText(/^Từ ngày/), inDays(40));
    await pickDate(user, within(dialog).getByLabelText(/^Đến ngày/), inDays(41));
    await pickDate(user, within(dialog).getByLabelText(/^Từ ngày/), inDays(45));
    expect(
      await within(dialog).findByText("Ngày kết thúc không được trước ngày bắt đầu"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dời cửa sổ giao" })).toBeDisabled();
  });

  it("S06-9: bằng chứng chỉ là tệp — không còn lựa chọn 'tin nhắn chat' bắt dán UUID; chưa có tệp thì chưa gửi được", async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Mã tin nhắn của khách/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tệp bằng chứng")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dời cửa sổ giao" })).toBeDisabled();
  });

  it("ghi chú chỉ khoảng trắng bị coi là trống", async () => {
    const { user, dialog } = await openDialog();
    await user.type(within(dialog).getByRole("textbox", { name: /Ghi chú/ }), "   ");
    expect(await within(dialog).findByText("Ghi chú là bắt buộc")).toBeInTheDocument();
  });
});

describe("Dời cửa sổ giao — lý do BE từ chối bằng tiếng Việt", () => {
  async function submitRefusedWith(code: string, status = 409) {
    mockPost(apiError(status, code));
    const { user } = await renderSchedule();
    const card = await panel();
    await user.click(
      within(card).getAllByRole("button", { name: "Dời cửa sổ giao" })[1] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    await pickDate(user, within(dialog).getByLabelText(/^Từ ngày/), inDays(40));
    await pickDate(user, within(dialog).getByLabelText(/^Đến ngày/), inDays(43));
    await pickOrderSelectOption(user, /Lý do/, /Khách xin dời/);
    await user.type(within(dialog).getByRole("textbox", { name: /Ghi chú/ }), "Khách xin dời");
    await attachEvidence(user, dialog);
    const submit = within(dialog).getByRole("button", { name: "Dời cửa sổ giao" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    return { dialog };
  }

  it("DELIVERY_BATCH_WINDOW_LOCKED (kho vừa bàn giao): đóng hộp thoại, toast tiếng Việt, tải lại lịch", async () => {
    const toastError = vi.spyOn(toast, "error");
    const get = vi.spyOn(api, "get");
    await submitRefusedWith("DELIVERY_BATCH_WINDOW_LOCKED");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("Không dời được cửa sổ giao");
    expect(toastError.mock.calls[0]?.[1]).toMatch(/đã có thùng bàn giao/);
    await waitFor(() => expect(callsTo(get, SCHEDULE_PATH)).toBeGreaterThanOrEqual(2));
  });

  it("CONFLICT (đơn vừa huỷ / đóng): đóng hộp thoại + toast 'Đơn đã huỷ, đã đóng hoặc đã hoàn tất'", async () => {
    const toastError = vi.spyOn(toast, "error");
    await submitRefusedWith("CONFLICT");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[1]).toMatch(/đã huỷ, đã đóng hoặc đã hoàn tất/);
  });

  it("VALIDATION_FAILED (bằng chứng không phải tin nhắn của khách…): GIỮ hộp thoại + dữ liệu, liệt kê điều kiện BR-28", async () => {
    const { dialog } = await submitRefusedWith("VALIDATION_FAILED", 400);
    expect(await within(dialog).findByText(/tin nhắn do chính khách gửi/)).toBeInTheDocument();
    expect(within(dialog).getByText(/trace-1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Đã tải lên: xac-nhan\.pdf/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/English/)).not.toBeInTheDocument();
  });

  it("OPTIMISTIC_LOCK: giữ hộp thoại, báo đơn vừa được cập nhật, không đóng", async () => {
    const { dialog } = await submitRefusedWith("OPTIMISTIC_LOCK");
    expect(await within(dialog).findByText(/vừa được người khác cập nhật/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
