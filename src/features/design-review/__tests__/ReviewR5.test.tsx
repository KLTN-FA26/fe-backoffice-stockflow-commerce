import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { DesignReviewDetail } from "..";
import { ARTIFACTS, CUSTOMER, CUSTOMER_ID, DESIGN_ID, PENDING_DESIGN } from "./fixtures";

import type { RouteTable } from "@/test/api-screen";

// jsdom has no ResizeObserver, which Radix Checkbox uses once ticked.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const detailUrl = `/designs/${DESIGN_ID}`;
const reviewUrl = `${detailUrl}/reviews`;
const PREFLIGHT = `${detailUrl}/artifacts/0a000000-0000-7000-8000-000000000004/preflight`;
const NEXT_ID = "01a1f291-0000-7000-8000-000000000002";

function routes(extra: RouteTable = {}): RouteTable {
  return {
    [detailUrl]: () => PENDING_DESIGN,
    [`${detailUrl}/artifacts`]: () => ARTIFACTS,
    [`${detailUrl}/history`]: () => bePage([]),
    [`${detailUrl}/quote-requests`]: () => [],
    [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
    ...extra,
  };
}

function open(get: RouteTable, post: RouteTable = {}) {
  const api = mockApi("PRODUCTION_COORDINATOR", { get, post });
  renderScreen(<DesignReviewDetail id={DESIGN_ID} />, "PRODUCTION_COORDINATOR");
  return api;
}

describe("Design review — round 5", () => {
  it("BO-UX-9: the preview comes before the submitted files (object page: profile → preview | files)", async () => {
    open(routes());
    const files = await screen.findByText("File đã gửi");
    const preview = screen.getByText("Màu in thật có thể khác màn hình.");
    expect(preview.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("BO-UX-8: opening 'Duyệt' runs the print-file check; blocking findings need an explicit tick", async () => {
    const api = open(
      routes({
        [PREFLIGHT]: () => ({
          passed: false,
          findings: [{ code: "FONT_NOT_EMBEDDED", detail: "Font Roboto", blocking: true }],
        }),
      }),
      { [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }) },
    );
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Kiểm tra file in có lỗi chặn:")).toBeInTheDocument();
    expect(within(dialog).getByText(/Font chưa nhúng — Font Roboto/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Duyệt" });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByLabelText("Tôi đã xem lỗi chặn và vẫn duyệt"));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(reviewUrl, { version: 7, approved: true }),
    );
  });

  it("BO-UX-8: a clean check says so and does not block", async () => {
    open(routes({ [PREFLIGHT]: () => ({ passed: true, findings: [] }) }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Kiểm tra file in: đạt, không có lỗi chặn."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Duyệt" })).toBeEnabled();
  });

  it("BO-UX-9: after a decision from the queue, the next design of the queue opens", async () => {
    open(
      routes({
        [PREFLIGHT]: () => ({ passed: true, findings: [] }),
        "/designs/review-queue": () =>
          bePage([PENDING_DESIGN, { ...PENDING_DESIGN, id: NEXT_ID, name: "Ly kế tiếp" }]),
      }),
      { [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }) },
    );
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const user = userEvent.setup();
    expect(
      await screen.findByLabelText("Sau khi quyết định, mở thiết kế tiếp theo trong hàng đợi"),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Kiểm tra file in: đạt, không có lỗi chặn.");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/admin/designs/review-queue/${NEXT_ID}`),
    );
  });

  it("BO-UX-9: unticked, it goes back to the queue", async () => {
    open(
      routes({
        [PREFLIGHT]: () => ({ passed: true, findings: [] }),
        "/designs/review-queue": () => bePage([{ ...PENDING_DESIGN, id: NEXT_ID }]),
      }),
      { [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }) },
    );
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const user = userEvent.setup();
    await user.click(
      await screen.findByLabelText("Sau khi quyết định, mở thiết kế tiếp theo trong hàng đợi"),
    );
    await user.click(screen.getByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Kiểm tra file in: đạt, không có lỗi chặn.");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/designs/review-queue"));
  });
});
