import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_PERMISSIONS, ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";

import {
  CONTRACT_ORDER_ID,
  contractDraft,
  contractDraftOverdue,
  contractOrderDto,
  contractSent,
} from "../../__fixtures__/contract";
import {
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../../__fixtures__/render";
import { toOrder } from "../../api";
import { dueRuleText } from "../../sales-contract-rules";
import { orderDtoSchema } from "../../schemas";

import { OrderContractSection } from "./OrderContractSection";

import type { PermissionCode } from "@/lib/auth";

const SALES: PermissionCode[] = [
  ORDER_PERMISSIONS.viewPage,
  ORDER_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.create,
  SALES_CONTRACT_PERMISSIONS.update,
  SALES_CONTRACT_PERMISSIONS.approve,
];
const PATH = `/orders/${CONTRACT_ORDER_ID}/contract`;
const draftOrder = toOrder(orderDtoSchema.parse(contractOrderDto));

function renderSection(
  contract: () => unknown,
  permissions = SALES,
  extra: Record<string, () => unknown> = {},
) {
  const get = mockOrderApiGet(permissions, { [PATH]: contract, ...extra });
  const can = (code: PermissionCode) => permissions.includes(code);
  renderOrderScreen(<OrderContractSection order={draftOrder} can={can} />);
  return { get };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dueRuleText", () => {
  it("writes the due rule as days after the milestone", () => {
    expect(dueRuleText({ milestone: "ON_SIGNING", dueDays: "" })).toBe("Hạn = ngày ký + 3 ngày");
    expect(dueRuleText({ milestone: "ON_SIGNING", dueDays: 5 })).toBe("Hạn = ngày ký + 5 ngày");
    expect(dueRuleText({ milestone: "BEFORE_DELIVERY", deliveryBatchSeq: "1" })).toBe(
      "Hạn = trước khi xuất hàng đợt 1",
    );
    expect(dueRuleText({ milestone: "AFTER_DELIVERY", dueDays: "30", deliveryBatchSeq: "2" })).toBe(
      "Hạn = ngày giao đợt 2 + 30 ngày",
    );
    expect(dueRuleText({ milestone: "AFTER_DELIVERY", dueDays: "" })).toBe(
      "Hạn = ngày giao + hạn tín dụng của khách",
    );
  });
});

describe("Contract editor — round 5", () => {
  it("B3 / BO-UX-26 / S06-2: each installment is a card with visible field labels and a due rule", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    // One card per installment, no table to scroll sideways.
    const plan = screen.getByRole("group", { name: "Lịch thanh toán" });
    expect(within(plan).queryByRole("table")).toBeNull();
    const cards = within(plan).getAllByRole("listitem");
    expect(cards).toHaveLength(contractDraft.paymentPlan.length);
    for (const label of ["Tên đợt", "Mốc", "Giá trị", "Hạn (ngày)", "Gắn đợt giao"])
      expect(within(cards[0] as HTMLElement).getByText(label)).toBeVisible();
    expect(screen.getByText("Hạn = ngày ký + 3 ngày")).toBeInTheDocument();
    expect(screen.getByText("Hạn = trước khi xuất hàng đợt 1")).toBeInTheDocument();
    expect(screen.getByText("Hạn = ngày giao đợt 2 + 30 ngày")).toBeInTheDocument();
    // The days field points at its rule.
    expect(screen.getByLabelText("Đợt 1 — số ngày")).toHaveAttribute(
      "aria-describedby",
      "plan-0-days-hint",
    );
  });

  it("BO-UX-26: an error is tied to its field (aria-invalid + aria-describedby)", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    await userEvent.clear(screen.getByLabelText("Đợt 2 — tên"));
    await userEvent.click(screen.getByRole("button", { name: /Lưu hợp đồng/ }));
    const name = screen.getByLabelText("Đợt 2 — tên");
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveAttribute("aria-describedby", "plan-1-name-error");
    expect(document.getElementById("plan-1-name-error")).toHaveTextContent("Nhập tên đợt");
  });

  it("S06-2: 'tính theo' is a ₫ | % button group beside the value, not a small select", async () => {
    renderSection(() => contractDraft);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Sửa/ }));
    const group = screen.getByRole("radiogroup", { name: "Đợt 2 — tính theo" });
    expect(within(group).getByRole("radio", { name: "Số tiền (₫)" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "% tổng đơn" })).not.toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "% tổng đơn" }));
    expect(within(group).getByRole("radio", { name: "% tổng đơn" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Số tiền (₫)" })).not.toBeChecked();
  });

  it("S06-2: switching ₫ | % clears the value (30 is not 30 ₫) and asks again once the form was submitted", async () => {
    renderSection(() => contractDraft);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Sửa/ }));
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("30");
    const group = screen.getByRole("radiogroup", { name: "Đợt 1 — tính theo" });
    await user.click(within(group).getByRole("radio", { name: "Số tiền (₫)" }));
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("");
    // Not submitted yet: no error shouted at once.
    expect(screen.queryByText("Số tiền nguyên VND > 0")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    expect(await screen.findByText("Số tiền nguyên VND > 0")).toBeInTheDocument();
    // After a submit, switching back clears and revalidates right away.
    await user.click(within(group).getByRole("radio", { name: "% tổng đơn" }));
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("");
    expect(await screen.findByText("% từ 0,01 đến 100 (2 số lẻ)")).toBeInTheDocument();
  });

  it("S06-2: the ₫ | % group is one Tab stop and the arrows move the choice", async () => {
    renderSection(() => contractDraft);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Sửa/ }));
    const group = screen.getByRole("radiogroup", { name: "Đợt 1 — tính theo" });
    const [amount, percent] = within(group).getAllByRole("radio");
    expect(percent).toHaveAttribute("tabindex", "0");
    expect(amount).toHaveAttribute("tabindex", "-1");
    (percent as HTMLElement).focus();
    await user.keyboard("{ArrowLeft}");
    expect(amount).toBeChecked();
    expect(amount).toHaveFocus();
  });

  it("S01-18: milestone and delivery batch are the one Select (Radix); the batch box is off for ON_SIGNING", async () => {
    renderSection(() => contractDraft);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Sửa/ }));
    // (Radix keeps an aria-hidden native <select> for form posts; a visible native one would not be hidden.)
    expect(document.querySelector("form select:not([aria-hidden])")).toBeNull();
    // Row 1 is ON_SIGNING: nothing to tie to a delivery batch.
    expect(screen.getByRole("combobox", { name: "Đợt 1 — đợt giao" })).toBeDisabled();
    await pickOrderSelectOption(user, "Đợt 1 — mốc", "Sau giao");
    expect(screen.getByRole("combobox", { name: "Đợt 1 — đợt giao" })).toBeEnabled();
    await pickOrderSelectOption(user, "Đợt 1 — đợt giao", "Đợt giao 2");
    expect(screen.getByText("Hạn = ngày giao đợt 2 + hạn tín dụng của khách")).toBeInTheDocument();
    // Back to "no batch": the dash item stands for the empty value.
    await pickOrderSelectOption(user, "Đợt 1 — đợt giao", "—");
    expect(screen.getByText("Hạn = ngày giao + hạn tín dụng của khách")).toBeInTheDocument();
  });

  it("S06-8: the two terms at the end are required (red star) with their unit inside the box; the view says 'lần' too", async () => {
    renderSection(() => contractDraft);
    expect(await screen.findByText("2 lần")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Sửa/ }));
    for (const [label, unit] of [
      [/Số lần in mẫu miễn phí/, "lần"],
      [/Thời hạn khiếu nại/, "ngày"],
    ] as const) {
      const box = screen.getByLabelText(label);
      expect(box).toHaveValue(unit === "lần" ? "2" : "7");
      const field = box.closest("div")?.parentElement as HTMLElement;
      expect(field).toHaveTextContent("*");
      expect(within(field).getByText(unit)).toBeInTheDocument();
    }
  });

  it("BO-UX-4: an amount is grouped as it is typed; a % row keeps a plain percent field", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    expect(screen.getByLabelText("Đợt 2 — giá trị")).toHaveValue("27.142.500");
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("30");
  });

  it("B1 / BO-UX-29: delivery windows are date pickers; each line shows the ordered cartons", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const start = screen.getByLabelText("Đợt 1 từ ngày");
    expect(start.tagName).toBe("INPUT");
    expect(start).toHaveAttribute("placeholder", "dd/mm/yyyy");
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getAllByText("/ 60 thùng")).toHaveLength(2);
    expect(screen.getByLabelText("Đợt 1 — LY-GIAY-DEMO-12OZ-XANH (thùng)")).toHaveAttribute(
      "aria-describedby",
      "batch-0-line-0-hint",
    );
  });

  it("BO-UX-5: 'Bỏ thay đổi' asks before throwing away edits", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Đợt 1 — tên"), " mới");
    await userEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Bỏ thay đổi" }));
    await waitFor(() => expect(screen.queryByLabelText("Đợt 1 — tên")).not.toBeInTheDocument());
  });
});

describe("Contract send — what is missing is said before the click (S06-3, R7)", () => {
  const withWindows = (windows: ([string, string] | null)[]) => ({
    ...contractDraft,
    deliverySchedule: contractDraft.deliverySchedule.map((batch, index) => {
      const window = windows[index];
      const { windowStart: _s, windowEnd: _e, ...rest } = batch;
      return window ? { ...rest, windowStart: window[0], windowEnd: window[1] } : rest;
    }),
  });

  it("a delivery batch without its window: the button is locked and the line under it names the batch", async () => {
    renderSection(() => withWindows([null, ["2099-12-23", "2099-12-25"]]));
    const send = await screen.findByRole("button", { name: /Gửi hợp đồng/ });
    expect(send).toBeDisabled();
    expect(screen.getByText("Còn thiếu: cửa sổ giao đợt 1.")).toBeInTheDocument();
    expect(send).toHaveAttribute("aria-describedby", "contract-send-blocked");
  });

  it("a window that starts before today is named too; the credit warning cannot bypass the lock", async () => {
    renderSection(() => ({
      ...withWindows([
        ["2020-01-01", "2020-01-02"],
        ["2099-12-23", "2099-12-25"],
      ]),
      creditWarning: contractDraftOverdue.creditWarning,
    }));
    expect(
      await screen.findByText(/^Cần sửa: cửa sổ giao đợt 1 bắt đầu trước hôm nay/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi hợp đồng/ })).toBeDisabled();
    // "Vẫn gửi" would open the same send dialog: it is not offered while the schedule is blocked.
    expect(screen.queryByRole("button", { name: "Vẫn gửi" })).toBeNull();
  });

  it("every window known and not in the past: nothing blocks", async () => {
    renderSection(() => contractDraft);
    expect(await screen.findByRole("button", { name: /Gửi hợp đồng/ })).toBeEnabled();
    expect(screen.queryByText(/^Còn thiếu:/)).toBeNull();
  });

  it("in the editor the window fields are marked required, and a new batch starts with the cartons still unscheduled", async () => {
    // 60 cartons ordered, only batch 1 (30) scheduled: the new batch gets the other 30.
    renderSection(() => ({
      ...contractDraft,
      deliverySchedule: [contractDraft.deliverySchedule[0]],
    }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Sửa/ }));
    // The date field is the typable picker of #303 (input + calendar button in their own box): climb to the field
    // that carries the visible "Từ ngày" label.
    let batch = screen.getByLabelText("Đợt 1 từ ngày").parentElement as HTMLElement;
    while (!within(batch).queryByText("Từ ngày") && batch.parentElement) batch = batch.parentElement;
    expect(within(batch).getByText("Từ ngày").textContent).toContain("*");
    await user.click(screen.getByRole("button", { name: /Thêm đợt giao/ }));
    expect(screen.getByLabelText("Đợt 2 — LY-GIAY-DEMO-12OZ-XANH (thùng)")).toHaveValue("30");
    // Nothing is left to schedule any more: a further batch starts at 0.
    await user.click(screen.getByRole("button", { name: /Thêm đợt giao/ }));
    expect(screen.getByLabelText("Đợt 3 — LY-GIAY-DEMO-12OZ-XANH (thùng)")).toHaveValue("0");
  });
});

describe("Contract summary and actions — round 5", () => {
  it("BO-UX-27: primary first, then Sửa, then the PDF; 'Huỷ hợp đồng' last", async () => {
    renderSection(() => contractDraft);
    await screen.findByRole("button", { name: /Gửi hợp đồng/ });
    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter((name) =>
        ["Gửi hợp đồng", "Sửa", "Xem trước PDF", "Huỷ hợp đồng"].includes(name ?? ""),
      );
    expect(names).toEqual(["Gửi hợp đồng", "Sửa", "Xem trước PDF", "Huỷ hợp đồng"]);
  });

  it("BO-UX-28: before signing the plan states the rule; the default complaint days are named", async () => {
    renderSection(() => ({ ...contractSent, returnWindowDays: undefined }));
    expect(await screen.findByText("Hạn = ngày ký + 3 ngày")).toBeInTheDocument();
    expect(screen.getByText("7 ngày (mặc định)")).toBeInTheDocument();
  });

  it("BO-UX-28: a signed contract shows due dates, overdue days, paid and outstanding", async () => {
    const signed = { ...contractSent, status: "SIGNED", signedOn: "2026-11-17", version: 2 };
    const installment = (seq: number, extra: Record<string, unknown>) => ({
      installmentId: `i${seq}`,
      seq,
      name: `Đợt ${seq}`,
      amount: 23_265_000,
      paidAmount: 0,
      status: "DUE",
      ...extra,
    });
    renderSection(() => signed, [...SALES, PAYMENT_INSTALLMENT_PERMISSIONS.read], {
      [`/installments/orders/${CONTRACT_ORDER_ID}`]: () => ({
        total: 77_550_000,
        paid: 10_000_000,
        currency: "VND",
        installments: [
          installment(1, {
            paidAmount: 10_000_000,
            outstanding: 13_265_000,
            dueDate: "2026-11-20",
            daysOverdue: 3,
            status: "PARTIALLY_PAID",
          }),
        ],
      }),
    });
    expect(await screen.findByRole("columnheader", { name: "Đã thu / Còn" })).toBeVisible();
    expect(screen.getByText("quá hạn 3 ngày")).toBeInTheDocument();
    expect(screen.getByText(/còn\s+13\.265\.000/)).toBeInTheDocument();
  });

  it("R5-12: a signed contract's own plan row carries dueDate (not dueOn) and daysOverdue", async () => {
    const signed = {
      ...contractSent,
      status: "SIGNED",
      signedOn: "2026-11-17",
      version: 2,
      paymentPlan: contractSent.paymentPlan.map((entry, index) =>
        index === 0 ? { ...entry, dueDate: "2026-11-20", daysOverdue: 4 } : entry,
      ),
    };
    // No installment permission: only the contract's plan says when the row falls due.
    renderSection(() => signed);
    expect(await screen.findByText("20/11/2026")).toBeInTheDocument();
    expect(screen.getByText("quá hạn 4 ngày")).toBeInTheDocument();
  });

  it("BO-UX-31: the history toggle says whether it is open", async () => {
    renderSection(() => contractDraft);
    const toggle = await screen.findByRole("button", { name: "Xem lịch sử hợp đồng" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ẩn lịch sử hợp đồng" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

describe("Record signed — round 5", () => {
  const CONVERSATION = "c4a70000-0000-4000-8000-000000000101";
  const chat = {
    "/chat/conversations": () => ({ items: [{ id: CONVERSATION }] }),
    [`/chat/conversations/${CONVERSATION}/messages`]: () => ({
      items: [
        {
          visibility: "CUSTOMER",
          senderType: "CUSTOMER",
          sentAt: "2026-11-18T03:00:00Z",
          attachments: [
            { id: "a1", fileName: "hd-da-ky.pdf", contentType: "application/pdf", sizeBytes: 900 },
            { id: "a2", fileName: "ghi-chu.txt", contentType: "text/plain", sizeBytes: 10 },
          ],
        },
        {
          visibility: "STAFF",
          senderType: "STAFF",
          sentAt: "2026-11-18T04:00:00Z",
          attachments: [
            { id: "a3", fileName: "noi-bo.pdf", contentType: "application/pdf", sizeBytes: 9 },
          ],
        },
      ],
    }),
    [`/chat/conversations/${CONVERSATION}/attachments/a1/link`]: () => ({
      url: "https://files.example.test/hd-da-ky.pdf",
    }),
  };

  it("B1: the signing date is a date picker", async () => {
    renderSection(() => contractSent);
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Ngày ký/).tagName).toBe("INPUT");
  });

  it("L-11: a file the customer sent in the chat can be used as the signed copy", async () => {
    const fetchMock = vi.fn(
      async () => new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderSection(() => contractSent, [...SALES, CHAT_PERMISSIONS.read], chat);
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    // Only the customer-visible PDF is offered: not the text file, not the internal note's file.
    const use = await within(dialog).findByRole("button", { name: "Dùng file hd-da-ky.pdf" });
    expect(within(dialog).queryByText("ghi-chu.txt")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("noi-bo.pdf")).not.toBeInTheDocument();
    await userEvent.click(use);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Dùng file hd-da-ky.pdf" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetchMock).toHaveBeenCalledWith("https://files.example.test/hd-da-ky.pdf");
    expect(within(dialog).getAllByText("hd-da-ky.pdf").length).toBeGreaterThan(1);
  });

  describe("S06-5 — files for the signed copy (a thread can carry several contracts)", () => {
    const THIS_CONTEXT = "ctx-this";
    const OTHER_CONTEXT = "ctx-other";
    const file = (id: string, name: string) => ({
      id,
      fileName: name,
      contentType: "application/pdf",
      sizeBytes: 9,
    });
    const message = (
      sentAt: string,
      attachment: ReturnType<typeof file>,
      extra: Record<string, unknown> = {},
    ) => ({
      visibility: "CUSTOMER",
      senderType: "CUSTOMER",
      sentAt,
      attachments: [attachment],
      ...extra,
    });
    const thread = (items: unknown[]) => ({
      "/chat/conversations": () => ({
        items: [
          {
            id: CONVERSATION,
            contexts: [
              { id: THIS_CONTEXT, kind: "CONTRACT", refId: contractSent.id },
              { id: OTHER_CONTEXT, kind: "CONTRACT", refId: "another-contract" },
            ],
          },
        ],
      }),
      [`/chat/conversations/${CONVERSATION}/messages`]: () => ({ items }),
      [`/chat/conversations/${CONVERSATION}/attachments/a2/link`]: () => ({
        url: "https://files.example.test/ban-ky-lan-2.pdf",
      }),
      [`/chat/conversations/${CONVERSATION}/attachments/a1/link`]: () => ({
        url: "https://files.example.test/ban-ky-lan-1.pdf",
      }),
    });
    const fetchPdf = () =>
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () => new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } }),
        ),
      );
    async function openSign(items: unknown[]) {
      fetchPdf();
      renderSection(() => contractSent, [...SALES, CHAT_PERMISSIONS.read], thread(items));
      await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
      const dialog = await screen.findByRole("dialog");
      const buttons = await within(dialog).findAllByRole("button", { name: /^Dùng file / });
      return { dialog, buttons };
    }

    it("lists only files sent after this contract was sent and not tied to another contract, newest first, two lines each; nothing is chosen when the BE ties no file to this contract", async () => {
      const { dialog, buttons } = await openSign([
        // Before the contract was sent (2026-11-16T03:00): a copy of another contract.
        message("2026-11-15T03:00:00Z", file("old", "hop-dong-cu.pdf")),
        message("2026-11-17T03:00:00Z", file("a1", "ban-ky-lan-1.pdf")),
        message("2026-11-18T03:00:00Z", file("a2", "ban-ky-lan-2.pdf")),
        // The BE ties this one to ANOTHER contract of the thread.
        message("2026-11-19T03:00:00Z", file("x", "hop-dong-khac.pdf"), {
          contextId: OTHER_CONTEXT,
        }),
      ]);
      expect(within(dialog).queryByText("hop-dong-cu.pdf")).not.toBeInTheDocument();
      expect(within(dialog).queryByText("hop-dong-khac.pdf")).not.toBeInTheDocument();
      expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
        "Dùng file ban-ky-lan-2.pdf",
        "Dùng file ban-ky-lan-1.pdf",
      ]);
      // No message says which contract these belong to: Sale chooses, nothing is used already.
      for (const button of buttons) expect(button).toHaveAttribute("aria-pressed", "false");
      expect(within(dialog).getByText("Chưa chọn tệp")).toBeInTheDocument();
      const row = (buttons[0] as HTMLElement).closest("li") as HTMLElement;
      expect(row).toHaveTextContent(/Khách gửi · .*· mới nhất/);
      expect(within(row).getByText("ban-ky-lan-2.pdf").className).toContain("block");
    });

    it("a customer file the BE ties to this contract is chosen already", async () => {
      const { dialog, buttons } = await openSign([
        message("2026-11-17T03:00:00Z", file("a1", "ban-ky-lan-1.pdf")),
        message("2026-11-18T03:00:00Z", file("a2", "ban-ky-lan-2.pdf"), {
          contextId: THIS_CONTEXT,
        }),
      ]);
      await waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: "Dùng file ban-ky-lan-2.pdf" }),
        ).toHaveAttribute("aria-pressed", "true"),
      );
      expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    });

    it("a file staff sent is never chosen already, even tied to this contract", async () => {
      const { dialog, buttons } = await openSign([
        message("2026-11-18T03:00:00Z", file("a2", "ban-ky-lan-2.pdf"), {
          senderType: "STAFF",
          contextId: THIS_CONTEXT,
        }),
      ]);
      expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
      expect(within(dialog).getByText("Chưa chọn tệp")).toBeInTheDocument();
      expect(within(dialog).getByText(/Nhân viên gửi/)).toBeInTheDocument();
    });

    it("a file Sale chose while the chosen-already one was still downloading is not replaced", async () => {
      let release: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              release = resolve;
            }),
        ),
      );
      renderSection(
        () => contractSent,
        [...SALES, CHAT_PERMISSIONS.read],
        thread([
          message("2026-11-18T03:00:00Z", file("a2", "ban-ky-lan-2.pdf"), {
            contextId: THIS_CONTEXT,
          }),
        ]),
      );
      await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByRole("button", { name: "Dùng file ban-ky-lan-2.pdf" });
      // Sale picks a file from the computer before the download ends.
      const own = new File(["x"], "scan-cua-toi.pdf", { type: "application/pdf" });
      await userEvent.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, own);
      expect(within(dialog).getByText("scan-cua-toi.pdf")).toBeInTheDocument();
      release(new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } }));
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(within(dialog).getByText("scan-cua-toi.pdf")).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: "Dùng file ban-ky-lan-2.pdf" }),
      ).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("L-11: without chat access nothing is offered", async () => {
    renderSection(() => contractSent, SALES, chat);
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Hoặc dùng file đã gửi trong chat")).not.toBeInTheDocument();
  });
});
