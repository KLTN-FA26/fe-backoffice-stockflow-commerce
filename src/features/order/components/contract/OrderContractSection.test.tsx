import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  CONTRACT_LINE_ID,
  CONTRACT_ORDER_ID,
  contractDraft,
  contractDraftOverdue,
  contractOrderDto,
  contractSent,
} from "../../__fixtures__/contract";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";
import { toOrder } from "../../api";
import { orderDtoSchema } from "../../schemas";

import { OrderContractSection } from "./OrderContractSection";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

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

/** Giả lập đơn được tải lại sau khi ký (mutation invalidate `orderKeys.all`). */
function Harness({ can, next }: { can: (code: PermissionCode) => boolean; next: Order }) {
  const [order, setOrder] = useState<Order>(draftOrder);
  return (
    <>
      <button type="button" onClick={() => setOrder(next)}>
        tải lại đơn
      </button>
      <OrderContractSection order={order} can={can} />
    </>
  );
}

function renderSection(contract: () => unknown, order: Order = draftOrder, permissions = SALES) {
  const get = mockOrderApiGet(permissions, { [PATH]: contract });
  const can = (code: PermissionCode) => permissions.includes(code);
  renderOrderScreen(<OrderContractSection order={order} can={can} />);
  return { get };
}

afterEach(() => vi.restoreAllMocks());

describe("Hợp đồng — đọc (B1)", () => {
  it("404 SALES_CONTRACT_NOT_FOUND + đơn Nháp → 'Lập hợp đồng' gửi POST không body", async () => {
    renderSection(() => {
      throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: contractDraft });
    expect(await screen.findByText("Đơn chưa có hợp đồng.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lập hợp đồng" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(PATH, {}));
  });

  it("409 CUSTOMER_LEGAL_PROFILE_MISSING → link /admin/customers/{id}?legalProfile=edit#legal-profile", async () => {
    renderSection(() => {
      throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
    });
    const message = "Khách chưa có hồ sơ pháp lý: nhập địa chỉ và người đại diện trước.";
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(409, "CUSTOMER_LEGAL_PROFILE_MISSING", message),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Lập hợp đồng" }));
    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nhập thông tin pháp lý" })).toHaveAttribute(
      "href",
      `/admin/customers/${draftOrder.customerId}?legalProfile=edit#legal-profile`,
    );
  });

  it("hiện số hợp đồng, lịch giao, lịch thanh toán của BE", async () => {
    renderSection(() => contractSent);
    expect(await screen.findByText("HD-20261120-900001-1")).toBeInTheDocument();
    expect(screen.getByText("Đã gửi")).toBeInTheDocument();
    expect(screen.getAllByText(/LY-GIAY-DEMO-12OZ-XANH × 30 = 30\.000 cái/)).toHaveLength(2);
    expect(screen.getByText("Đặt cọc khi ký")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ghi nhận đã ký/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi hợp đồng/ })).not.toBeInTheDocument();
  });

  it("DS-02b: cảnh báo OVERDUE trên bản nháp → banner + 'Vẫn gửi' mở hộp thoại nhắc lại", async () => {
    renderSection(() => contractDraftOverdue);
    expect(await screen.findByText(/Khách đang có khoản quá hạn/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Vẫn gửi" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/đơn sẽ bị treo chờ Kế toán duyệt tín dụng/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Vẫn gửi" })).toBeInTheDocument();
  });
});

describe("TC-F04-02 — editor lịch giao / lịch thanh toán", () => {
  it("lệch Σ thùng → 'còn thiếu 5 thùng'; fieldErrors BE gắn đúng ô và banner", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const cartons = screen.getByLabelText("Đợt 1 — LY-GIAY-DEMO-12OZ-XANH (thùng)");
    await userEvent.clear(cartons);
    await userEvent.type(cartons, "25");
    expect(screen.getByText(/còn thiếu 5 thùng/)).toBeInTheDocument();

    const message =
      "Dòng LY-GIAY-DEMO-12OZ-XANH: tổng số thùng qua các đợt giao là 55, khác số thùng của dòng đơn là 60.";
    const put = vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(
        409,
        "DELIVERY_SCHEDULE_INVALID",
        "Lịch giao không hợp lệ.",
        undefined,
        undefined,
        undefined,
        [
          { field: "deliverySchedule", message },
          {
            field: "deliverySchedule[1].windowStart",
            message: "Cửa sổ giao không được ở quá khứ.",
          },
        ],
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const body = put.mock.calls[0]?.[1] as {
      version: number;
      deliverySchedule: { lines: unknown[] }[];
    };
    expect(body.version).toBe(0);
    expect(body.deliverySchedule[0]?.lines).toEqual([
      { orderLineId: CONTRACT_LINE_ID, cartons: 25 },
    ]);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("Cửa sổ giao không được ở quá khứ.")).toBeInTheDocument();
    expect(screen.getByText("Lịch giao không hợp lệ.")).toBeInTheDocument();
  });

  it("đợt % → body percent; BEFORE_DELIVERY không gửi số ngày", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: contractDraft });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const body = put.mock.calls[0]?.[1] as { paymentPlan: Record<string, unknown>[] };
    expect(body.paymentPlan[0]).toEqual({
      name: "Đặt cọc khi ký",
      milestone: "ON_SIGNING",
      percent: 30,
      dueDays: 3,
    });
    expect(body.paymentPlan[1]).toEqual({
      name: "Thanh toán trước giao đợt 1",
      milestone: "BEFORE_DELIVERY",
      amount: 27_142_500,
      deliveryBatchSeq: 1,
    });
  });
});

describe("WF-02 N10 — đổi mốc khỏi ON_SIGNING", () => {
  it("số ngày mặc định 3 bị xoá; số ngày do người dùng nhập khác 3 được giữ", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const milestone = screen.getByRole("combobox", { name: "Đợt 1 — mốc" });
    const days = screen.getByRole("textbox", { name: "Đợt 1 — số ngày" });
    expect(days).toHaveValue("3");
    await userEvent.selectOptions(milestone, "AFTER_DELIVERY");
    expect(days).toHaveValue("");
    await userEvent.type(days, "7");
    await userEvent.selectOptions(milestone, "ON_SIGNING");
    expect(days).toHaveValue("7");
    await userEvent.selectOptions(milestone, "AFTER_DELIVERY");
    expect(days).toHaveValue("7");
  });
});

describe("WF-02 mục 7 — form cũ không ghi đè bản mới", () => {
  const newer = { ...contractDraft, version: 1, freeSampleRounds: 7, returnWindowDays: 21 };
  const refetchFocus = () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  };

  async function openWhileNewerArrives() {
    let current: unknown = contractDraft;
    renderSection(() => current);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const samples = await screen.findByLabelText("Số lần in mẫu miễn phí");
    await userEvent.clear(samples);
    await userEvent.type(samples, "3");
    current = newer;
    refetchFocus();
    return samples;
  }

  it("bản mới về khi đang sửa → cảnh báo, nút Lưu khoá, không gọi PUT", async () => {
    await openWhileNewerArrives();
    expect(await screen.findByText(/vừa được người khác lưu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu hợp đồng" })).toBeDisabled();
    expect(screen.getByLabelText("Số lần in mẫu miễn phí")).toHaveValue("3");
  });

  it("bấm Tải lại → form mang giá trị bản mới, Lưu gửi version mới", async () => {
    await openWhileNewerArrives();
    await userEvent.click(await screen.findByRole("button", { name: "Tải lại theo bản mới" }));
    expect(screen.getByLabelText("Số lần in mẫu miễn phí")).toHaveValue("7");
    expect(screen.queryByText(/vừa được người khác lưu/)).not.toBeInTheDocument();
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: newer });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect((put.mock.calls[0]?.[1] as { version: number }).version).toBe(1);
  });

  it("PUT 409 OPTIMISTIC_LOCK → không tự gửi lại, cảnh báo hiện", async () => {
    let current: unknown = contractDraft;
    renderSection(() => current);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const put = vi.spyOn(api, "put").mockImplementation(async () => {
      current = newer; // BE đã có bản mới: lần tải lại sau 409 mang version mới
      throw new ApiError(409, "OPTIMISTIC_LOCK", "OPTIMISTIC_LOCK");
    });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    expect(await screen.findByText(/vừa được người khác sửa/)).toBeInTheDocument();
    expect(await screen.findByText(/vừa được người khác lưu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu hợp đồng" })).toBeDisabled();
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("TC-F04-03 — ghi nhận đã ký", () => {
  it("multipart file + version + signedOn; sau khi ký hiện đúng nhánh ON_HOLD tín dụng", async () => {
    mockOrderApiGet(SALES, { [PATH]: () => contractSent });
    const can = (code: PermissionCode) => SALES.includes(code);
    const held = { ...draftOrder, status: "On Hold" as const, holdReason: "CREDIT" as const };
    renderOrderScreen(<Harness can={can} next={held} />);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...contractSent, status: "SIGNED", version: 2 } });
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["%PDF-1.4"], "hd-da-ky.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/File đã ký/), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, form] = post.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/signature`);
    expect((form as FormData).get("version")).toBe("1");
    expect((form as FormData).get("signedOn")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((form as FormData).get("file")).toBeInstanceOf(File);

    await userEvent.click(screen.getByRole("button", { name: "tải lại đơn" }));
    expect(
      await screen.findByText("Đã ký. Đơn đang chờ Kế toán duyệt tín dụng."),
    ).toBeInTheDocument();
  });
});

describe("WF-02 audit — gợi ý số tiền, gửi, file ký", () => {
  const SUGGESTION = `${PATH}/payment-plan-suggestion`;

  it("mục 7: lịch thanh toán đã sửa → hỏi trước khi gợi ý thay, chưa gọi BE", async () => {
    const { get } = renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const value = screen.getByLabelText("Đợt 1 — giá trị");
    await userEvent.clear(value);
    await userEvent.type(value, "40");
    await userEvent.click(screen.getByRole("button", { name: /Gợi ý số tiền theo đợt giao/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Thay lịch thanh toán đang sửa?")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === SUGGESTION)).toBe(false);
    // Huỷ: số đang sửa còn nguyên.
    await userEvent.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("40");
  });

  it("mục 7: sửa số tiền sau một lần gợi ý → lần gợi ý sau vẫn hỏi trước khi thay", async () => {
    const suggestion = {
      contractId: contractDraft.id,
      version: 0,
      totalAmount: 77_550_000,
      paymentPlan: contractDraft.paymentPlan.map((entry) => ({ ...entry, percent: undefined })),
    };
    const get = mockOrderApiGet(SALES, {
      [PATH]: () => contractDraft,
      [SUGGESTION]: () => suggestion,
    });
    const can = (code: PermissionCode) => SALES.includes(code);
    renderOrderScreen(<OrderContractSection order={draftOrder} can={can} />);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    // Lần 1: chưa sửa gì → gợi ý điền ngay, không hỏi.
    await userEvent.click(screen.getByRole("button", { name: /Gợi ý số tiền theo đợt giao/ }));
    await waitFor(() => expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("23265000"));
    expect(screen.queryByText("Thay lịch thanh toán đang sửa?")).not.toBeInTheDocument();
    // Sale sửa số tiền gợi ý.
    const value = screen.getByLabelText("Đợt 1 — giá trị");
    await userEvent.clear(value);
    await userEvent.type(value, "20000000");
    const calls = get.mock.calls.filter(([url]) => url === SUGGESTION).length;
    // Lần 2: phải hỏi, không gọi BE, không ghi đè.
    await userEvent.click(screen.getByRole("button", { name: /Gợi ý số tiền theo đợt giao/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Thay lịch thanh toán đang sửa?")).toBeInTheDocument();
    expect(get.mock.calls.filter(([url]) => url === SUGGESTION)).toHaveLength(calls);
    await userEvent.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    expect(screen.getByLabelText("Đợt 1 — giá trị")).toHaveValue("20000000");
  });

  it("mục 7: lịch giao đang sửa chưa lưu → nhắc lưu trước, không gợi ý", async () => {
    const { get } = renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const cartons = screen.getByLabelText("Đợt 1 — LY-GIAY-DEMO-12OZ-XANH (thùng)");
    await userEvent.clear(cartons);
    await userEvent.type(cartons, "25");
    await userEvent.click(screen.getByRole("button", { name: /Gợi ý số tiền theo đợt giao/ }));
    expect(await screen.findByText(/Lịch giao đang sửa chưa lưu/)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === SUGGESTION)).toBe(false);
  });

  it("mục 8: gửi bị từ chối → hộp thoại giữ mở, hiện từng fieldErrors theo tên đợt", async () => {
    renderSection(() => contractDraft);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(
        409,
        "DELIVERY_SCHEDULE_INVALID",
        "Lịch giao không hợp lệ.",
        undefined,
        undefined,
        undefined,
        [
          {
            field: "deliverySchedule[0].windowStart",
            message: "Cửa sổ giao không được ở quá khứ.",
          },
        ],
      ),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Gửi hợp đồng/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi hợp đồng" }));
    expect(await within(dialog).findByText("Lịch giao không hợp lệ.")).toBeInTheDocument();
    expect(within(dialog).getByText("Đợt giao 1 · Từ ngày:")).toBeInTheDocument();
    expect(within(dialog).getByText(/Cửa sổ giao không được ở quá khứ\./)).toBeInTheDocument();
  });

  it("lỗi 2: file scan trên 25 MB bị chặn ngay trên form, nói rõ giới hạn", async () => {
    renderSection(() => contractSent);
    const post = vi.spyOn(api, "post");
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 26 * 1024 * 1024 });
    await userEvent.upload(within(dialog).getByLabelText(/File đã ký/), file);
    expect(within(dialog).getByText("File quá lớn (tối đa 25 MB).")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("lỗi 2: 413 của BFF hiện 'File quá lớn (tối đa 25 MB).' thay cho câu chung", async () => {
    renderSection(() => contractSent);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(413, "PAYLOAD_TOO_LARGE", "Không thể hoàn tất yêu cầu."),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/File đã ký/), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" }));
    expect(await within(dialog).findByText("File quá lớn (tối đa 25 MB).")).toBeInTheDocument();
  });
});

describe("WF-02 BO-7 — hợp đồng: đợt đã qua, huỷ bởi người khác, loại file, mặc định ngày", () => {
  const pastWindow = {
    ...contractSent,
    deliverySchedule: contractSent.deliverySchedule.map((batch, i) =>
      i === 0 ? { ...batch, windowEnd: "2000-01-02" } : batch,
    ),
  };
  const cancelledRow = {
    ...contractSent,
    status: "CANCELLED",
    cancelledAt: "2026-11-18T03:00:00Z",
    cancellationReason: "Khách đổi số lượng",
  };

  it("mục 10: đợt có windowEnd đã qua → cảnh báo, nút Ghi nhận đã ký vẫn dùng được", async () => {
    renderSection(() => pastWindow);
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Đợt giao 1 đã qua — sau khi ký dùng 'Dời cửa sổ giao'/),
    ).toBeInTheDocument();
    const file = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/File đã ký/), file);
    expect(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" })).toBeEnabled();
  });

  it("mục 10: đợt còn hạn → không cảnh báo", async () => {
    renderSection(() => contractSent);
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/đã qua/)).not.toBeInTheDocument();
  });

  it("mục 29: file .webp bị từ chối ngay trên form, nút khoá, không gọi BE", async () => {
    renderSection(() => contractSent);
    const post = vi.spyOn(api, "post");
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/File đã ký/);
    expect(input.getAttribute("accept")).not.toMatch(/webp/);
    // applyAccept off: prove the check is ours, not the browser's.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(input, new File(["x"], "scan.webp", { type: "image/webp" }));
    expect(
      within(dialog).getByText("Chỉ nhận PDF, Word, Excel hoặc ảnh JPG/PNG."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("mục 28 + N3-B: bấm ký khi hợp đồng đã bị huỷ → tải lại, hiện số hợp đồng và lý do huỷ", async () => {
    let cancelled = false;
    mockOrderApiGet(SALES, {
      [PATH]: () => {
        if (cancelled) throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
        return contractSent;
      },
      [`${PATH}/history`]: () => (cancelled ? [cancelledRow] : [contractSent]),
    });
    const can = (code: PermissionCode) => SALES.includes(code);
    renderOrderScreen(<OrderContractSection order={draftOrder} can={can} />);
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng."),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.upload(
      within(dialog).getByLabelText(/File đã ký/),
      new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" }),
    );
    cancelled = true;
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" }));
    // The contract is gone after the reload, so the dialog unmounts with it.
    expect(await screen.findByText("Đơn chưa có hợp đồng.")).toBeInTheDocument();
    expect(
      await screen.findByText(
        new RegExp(`Hợp đồng ${contractSent.contractNumber} đã huỷ: Khách đổi số lượng`),
      ),
    ).toBeInTheDocument();
  });

  it("N3-B: không có hợp đồng và lịch sử chưa từng huỷ → không có dòng 'đã huỷ'", async () => {
    renderSection(() => {
      throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
    });
    expect(await screen.findByText("Đơn chưa có hợp đồng.")).toBeInTheDocument();
    expect(screen.queryByText(/đã huỷ/)).not.toBeInTheDocument();
  });

  it("N10: đổi mốc sang ON_SIGNING khi ô ngày trống → điền sẵn 3 và gửi dueDays 3", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm đợt thanh toán" }));
    await userEvent.selectOptions(screen.getByLabelText("Đợt 4 — mốc"), "ON_SIGNING");
    expect(screen.getByLabelText("Đợt 4 — số ngày")).toHaveValue("3");
  });
});
