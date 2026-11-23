import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REQUESTS_PATH,
  WF4_PERMISSION_SETS,
  apiCancellationRequest,
  renderWf4Detail,
  requestPage,
} from "../../__fixtures__/wf4";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

async function openApprove(patch: Record<string, unknown>) {
  await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
    [REQUESTS_PATH]: () => requestPage([apiCancellationRequest(patch)]),
  });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Duyệt huỷ" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("Cancellation fee dialog — round 5 (BO-UX-35)", () => {
  it("shows what the customer paid and that printing has not started; the fee options are locked", async () => {
    const { dialog } = await openApprove({ paidTotal: 23_265_000, printingStarted: false });
    expect(within(dialog).getByText("Khách đã trả")).toBeInTheDocument();
    expect(within(dialog).getByText(/23\.265\.000/)).toBeInTheDocument();
    expect(within(dialog).getByText("Chưa in hàng loạt")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" })).toBeDisabled();
    expect(
      within(dialog).getByRole("radio", { name: "Giữ theo số tiền thoả thuận với khách" }),
    ).toBeDisabled();
    expect(within(dialog).getByText(/không giữ phí được/)).toBeInTheDocument();
  });

  it("once printed, the fee options are open", async () => {
    const { dialog } = await openApprove({ paidTotal: 23_265_000, printingStarted: true });
    expect(within(dialog).getByText("Đã in hàng loạt")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" })).toBeEnabled();
  });

  it("without the BE facts nothing is guessed: options open, no paid line", async () => {
    const { dialog } = await openApprove({});
    expect(within(dialog).queryByText("Khách đã trả")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Giữ theo % số tiền đã thu" })).toBeEnabled();
  });

  it("the agreed amount is grouped as typed and its error is tied to the field", async () => {
    const { user, dialog } = await openApprove({ printingStarted: true });
    await user.click(
      within(dialog).getByRole("radio", { name: "Giữ theo số tiền thoả thuận với khách" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Duyệt và huỷ đơn" }));
    const amount = within(dialog).getByLabelText(/Số tiền phí/);
    expect(amount).toHaveAttribute("aria-invalid", "true");
    const describedBy = amount.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy.split(" ")[0] ?? "")).toHaveTextContent(
      "Nhập số tiền nguyên lớn hơn 0",
    );
    await user.type(amount, "1500000");
    expect(amount).toHaveValue("1.500.000");
  });
});
