import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import { TooltipProvider } from "@/components/ui/tooltip";

import { CreditRequestDetail } from "../components/CreditRequestDetail";
import { CreditRequestList } from "../components/CreditRequestList";
import { pendingApproval, REQUEST_ID, submitted } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL = `/credit-requests/${REQUEST_ID}`;

afterEach(() => vi.restoreAllMocks());

describe("Danh sách đề nghị cấp hạn mức", () => {
  it("lọc theo khách từ URL gửi customerId; dòng hiện khách, hạn mức, trạng thái", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/credit-requests": () => bePage([pendingApproval]) },
    });
    renderScreen(<CreditRequestList />, "ACCOUNTANT", `?customerId=${submitted.customerId}`);
    expect(await screen.findByRole("link", { name: "Công ty Ly Giấy Xanh" })).toBeInTheDocument();
    expect(screen.getByText("Chờ Kế toán duyệt")).toBeInTheDocument();
    const call = get.mock.calls.find(([url]) => url === "/credit-requests");
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("customerId")).toBe(submitted.customerId);
  });

  it("bo-28: không lọc trạng thái → không có chip 'Trạng thái Tất cả' lặp lại nút lọc; lọc từ URL → chip có X", async () => {
    mockApi("ACCOUNTANT", { get: { "/credit-requests": () => bePage([pendingApproval]) } });
    const view = renderScreen(<CreditRequestList />, "ACCOUNTANT");
    await screen.findByRole("link", { name: "Công ty Ly Giấy Xanh" });
    expect(screen.queryByText("Tất cả")).not.toBeInTheDocument();
    view.unmount();
    mockApi("ACCOUNTANT", { get: { "/credit-requests": () => bePage([pendingApproval]) } });
    renderScreen(<CreditRequestList />, "ACCOUNTANT", "?status=PENDING_APPROVAL");
    expect(await screen.findByRole("button", { name: "Xoá Trạng thái" })).toBeInTheDocument();
  });

  it("?create= (lối từ trang khách, A2) mở form tạo cho Sale", async () => {
    mockApi("SALES_STAFF", { get: { "/credit-requests": () => bePage([]) } });
    renderScreen(
      <TooltipProvider>
        <CreditRequestList />
      </TooltipProvider>,
      "SALES_STAFF",
      "?create=",
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent("Tạo đề nghị cấp hạn mức");
  });
});

describe("Chi tiết đề nghị — action-gating", () => {
  it("Sale + SUBMITTED → Ghi ý kiến gửi version + note", async () => {
    const { post } = mockApi("SALES_STAFF", {
      get: { [DETAIL]: () => submitted },
      post: { [`${DETAIL}/recommendation`]: () => pendingApproval },
    });
    renderScreen(<CreditRequestDetail id={REQUEST_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Ghi ý kiến/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^Ý kiến/), "Đồng ý 300 triệu");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi ý kiến" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/recommendation`, {
        version: 0,
        note: "Đồng ý 300 triệu",
      }),
    );
    expect(screen.queryByRole("button", { name: /^Duyệt$/ })).not.toBeInTheDocument();
  });

  it("Kế toán + PENDING_APPROVAL → số liệu xét + cảnh báo; Duyệt gửi creditTermsVersion", async () => {
    const { post } = mockApi("ACCOUNTANT", {
      get: { [DETAIL]: () => pendingApproval },
      post: { [`${DETAIL}/approval`]: () => ({ ...pendingApproval, status: "APPROVED" }) },
    });
    renderScreen(<CreditRequestDetail id={REQUEST_ID} />, "ACCOUNTANT");
    expect(await screen.findByText("Số liệu xét duyệt")).toBeInTheDocument();
    expect(screen.getByText("Khách có ít hợp đồng đã trả đủ")).toBeInTheDocument();
    expect(screen.getByText("Khách mua đều, đề xuất 300 triệu.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Duyệt$/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/approval`, {
        version: 1,
        creditTermsVersion: 4,
        approvedLimit: 300_000_000,
        approvedTermDays: 45,
        note: "",
      }),
    );
  });

  it("Kế toán: hạn mức duyệt cao hơn mức xin → lỗi inline, khoá nút", async () => {
    mockApi("ACCOUNTANT", { get: { [DETAIL]: () => pendingApproval } });
    renderScreen(<CreditRequestDetail id={REQUEST_ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /^Duyệt$/ }));
    const dialog = await screen.findByRole("dialog");
    const limit = within(dialog).getByLabelText(/Hạn mức duyệt/);
    await userEvent.clear(limit);
    await userEvent.type(limit, "600000000");
    expect(
      await within(dialog).findByText("Không được cao hơn hạn mức khách xin"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Duyệt" })).toBeDisabled();
  });

  it("Kế toán + SUBMITTED → chưa có nút quyết", async () => {
    mockApi("ACCOUNTANT", { get: { [DETAIL]: () => submitted } });
    renderScreen(<CreditRequestDetail id={REQUEST_ID} />, "ACCOUNTANT");
    expect(await screen.findByText("Số liệu xét duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Duyệt$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Từ chối/ })).not.toBeInTheDocument();
  });
});
