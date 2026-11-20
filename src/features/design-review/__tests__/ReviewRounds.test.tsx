import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { ReviewRoundDetail, ReviewRoundList } from "..";
import { pendingInRound, roundProgress } from "../selectors";
import { CUSTOMER, CUSTOMER_ID, PENDING_DESIGN } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const ROUND_ID = "0r000000-0000-7000-8000-000000000001";
const roundUrl = `/design-review-rounds/${ROUND_ID}`;
const approvalsUrl = `${roundUrl}/approvals`;
const D1 = "0d000000-0000-7000-8000-000000000001";
const D2 = "0d000000-0000-7000-8000-000000000002";
const D3 = "0d000000-0000-7000-8000-000000000003";
const D4 = "0d000000-0000-7000-8000-000000000004";

const design = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  ...PENDING_DESIGN,
  id,
  name,
  ...extra,
});

/** D1, D2 chờ (version 7 / 9); D3 đã duyệt; D4 bị trả lại (BE bỏ `design`). */
function round(overrides: Record<string, unknown> = {}) {
  return {
    id: ROUND_ID,
    projectId: "0p000000-0000-7000-8000-000000000002",
    projectName: "Bộ ly Tết",
    customerId: CUSTOMER_ID,
    customerName: "Cửa hàng Trà Sen",
    submittedBy: CUSTOMER_ID,
    submittedAt: "2026-11-18T03:00:00Z",
    designs: [
      { designId: D1, design: design(D1, "Ly A") },
      { designId: D2, design: design(D2, "Ly B", { version: 9 }) },
      {
        designId: D3,
        design: design(D3, "Ly C", { status: "APPROVED" }),
        outcome: "APPROVED",
        decidedAt: "2026-11-19T03:00:00Z",
      },
      { designId: D4, outcome: "RETURNED", decidedAt: "2026-11-19T04:00:00Z" },
    ],
    ...overrides,
  };
}

function open(post: Record<string, () => unknown> = {}, data: unknown = round()) {
  const api = mockApi("SALES_MANAGER", {
    get: { [roundUrl]: () => data, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    post,
  });
  renderScreen(<ReviewRoundDetail roundId={ROUND_ID} />, "SALES_MANAGER");
  return api;
}

const approveAllButton = () => screen.findByRole("button", { name: /Duyệt tất cả/ });

async function runApproveAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await approveAllButton());
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Duyệt tất cả" }));
}

describe("selector vòng duyệt", () => {
  const r = round() as unknown as Parameters<typeof pendingInRound>[0];

  it("pendingInRound: chỉ thiết kế chưa có outcome và đang chờ duyệt, kèm version", () => {
    expect(pendingInRound(r)).toEqual([
      { id: D1, version: 7 },
      { id: D2, version: 9 },
    ]);
  });

  it("pendingInRound: thiết kế đã bị rút khỏi hàng chờ nhưng chưa có outcome không được gửi", () => {
    const moved = {
      designs: [{ designId: D1, design: design(D1, "Ly A", { status: "DRAFT" }) }],
    } as unknown as Parameters<typeof pendingInRound>[0];
    expect(pendingInRound(moved)).toEqual([]);
  });

  it("roundProgress: đếm đã duyệt / đã trả lại / còn chờ", () => {
    expect(roundProgress(r)).toEqual({ approved: 1, returned: 1, waiting: 2 });
  });
});

describe("Danh sách vòng duyệt", () => {
  it("hiện dự án, khách, số thiết kế, còn chờ / đã quyết", async () => {
    const api = mockApi("SALES_MANAGER", {
      get: { "/design-review-rounds": () => bePage([round()]) },
    });
    renderScreen(<ReviewRoundList />, "SALES_MANAGER");
    expect(await screen.findByRole("link", { name: "Bộ ly Tết" })).toHaveAttribute(
      "href",
      `/admin/design-review-rounds/${ROUND_ID}`,
    );
    expect(screen.getByText("Cửa hàng Trà Sen")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Thiết kế đơn lẻ/ })).toBeInTheDocument();
    const call = api.get.mock.calls.find((c) => c[0] === "/design-review-rounds")?.[1] as {
      params: { page: number };
    };
    expect(call.params.page).toBe(0);
  });

  it("trống: 'Không có vòng duyệt nào đang chờ'", async () => {
    mockApi("SALES_MANAGER", { get: { "/design-review-rounds": () => bePage([]) } });
    renderScreen(<ReviewRoundList />, "SALES_MANAGER");
    expect(await screen.findByText("Không có vòng duyệt nào đang chờ")).toBeInTheDocument();
  });
});

describe("Chi tiết vòng duyệt", () => {
  it("Duyệt tất cả gửi đúng {designs:[{id,version}]} chỉ của thiết kế còn chờ", async () => {
    const api = open({
      [approvalsUrl]: () => ({
        outcomes: [
          { designId: D1, outcome: "APPROVED" },
          { designId: D2, outcome: "APPROVED" },
        ],
        round: round({
          closedAt: "2026-11-20T01:00:00Z",
          designs: [
            {
              designId: D1,
              design: design(D1, "Ly A", { status: "APPROVED" }),
              outcome: "APPROVED",
            },
            {
              designId: D2,
              design: design(D2, "Ly B", { status: "APPROVED" }),
              outcome: "APPROVED",
            },
            { designId: D4, outcome: "RETURNED" },
          ],
        }),
      }),
    });
    const user = userEvent.setup();
    expect(await approveAllButton()).toHaveTextContent("Duyệt tất cả (2)");
    await runApproveAll(user);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(approvalsUrl, {
        designs: [
          { id: D1, version: 7 },
          { id: D2, version: 9 },
        ],
      }),
    );
    // Cache ghi bằng `round` trong response: vòng đã đóng, không có nút, không tải lại.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Duyệt tất cả/ })).not.toBeInTheDocument(),
    );
    expect(api.get.mock.calls.filter((c) => c[0] === roundUrl)).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Kết quả duyệt tất cả" })).toBeInTheDocument();
  });

  it("một thiết kế NOT_APPROVED → dòng đó hiện message, thẻ vẫn 'Đang chờ', nút vẫn bật với 1 thiết kế", async () => {
    const api = open({
      [approvalsUrl]: () => ({
        outcomes: [
          { designId: D1, outcome: "APPROVED" },
          {
            designId: D2,
            outcome: "NOT_APPROVED",
            errorCode: "DESIGN_PRINT_FILE_INVALID",
            message: "File in không đạt kiểm tra",
          },
        ],
        round: round({
          designs: [
            {
              designId: D1,
              design: design(D1, "Ly A", { status: "APPROVED" }),
              outcome: "APPROVED",
            },
            { designId: D2, design: design(D2, "Ly B", { version: 9 }) },
          ],
        }),
      }),
    });
    const user = userEvent.setup();
    await runApproveAll(user);
    const result = await screen.findByRole("region", { name: "Kết quả duyệt tất cả" });
    expect(within(result).getByText("File in không đạt kiểm tra")).toBeInTheDocument();
    expect(within(result).getByText("Không duyệt được")).toBeInTheDocument();
    expect(await approveAllButton()).toHaveTextContent("Duyệt tất cả (1)");
    expect(await approveAllButton()).toBeEnabled();
    const cardB = within(screen.getByRole("list")).getByText("Ly B").closest("li");
    expect(cardB).not.toBeNull();
    expect(within(cardB as HTMLElement).getByText("Đang chờ")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("hơn 20 thiết kế chờ → chỉ gửi 20 đầu và nói phải duyệt tiếp", async () => {
    const ids = Array.from({ length: 22 }, (_, i) => `0d0000${String(i).padStart(2, "0")}`);
    const api = open(
      { [approvalsUrl]: () => ({ outcomes: [], round: round() }) },
      round({ designs: ids.map((id) => ({ designId: id, design: design(id, `Ly ${id}`) })) }),
    );
    const user = userEvent.setup();
    expect(await approveAllButton()).toHaveTextContent("Duyệt tất cả (22)");
    await user.click(await approveAllButton());
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Còn 2 thiết kế nữa/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Duyệt tất cả" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const body = api.post.mock.calls[0]?.[1] as { designs: { id: string }[] };
    expect(body.designs.map((d) => d.id)).toEqual(ids.slice(0, 20));
  });

  it("kết quả lần duyệt trước biến mất khi lần sau hết giờ (vòng đã được tải lại)", async () => {
    vi.spyOn(toast, "warning").mockImplementation(() => undefined);
    let calls = 0;
    open({
      [approvalsUrl]: () => {
        calls += 1;
        if (calls > 1) throw apiError(0, "NETWORK_ERROR");
        return {
          outcomes: [
            { designId: D1, outcome: "NOT_APPROVED", errorCode: "X", message: "File lỗi" },
          ],
          round: round(),
        };
      },
    });
    const user = userEvent.setup();
    await runApproveAll(user);
    expect(await screen.findByRole("region", { name: "Kết quả duyệt tất cả" })).toBeInTheDocument();
    await runApproveAll(user);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Kết quả duyệt tất cả" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("vòng đã đóng → không có nút Duyệt tất cả", async () => {
    open({}, round({ closedAt: "2026-11-20T01:00:00Z" }));
    expect(await screen.findByText(/Đã đóng lúc/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Duyệt tất cả/ })).not.toBeInTheDocument();
  });

  it("design bị trả lại (design vắng) → thẻ chỉ hiện 'Đã trả lại', không ảnh", async () => {
    open();
    const cards = await screen.findAllByRole("listitem");
    const returned = cards.find((card) => within(card).queryByText("Đã trả lại"));
    expect(returned).toBeDefined();
    const card = returned as HTMLElement;
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(card.textContent).toBe("Đã trả lại");
  });

  it("thẻ còn chờ dẫn tới chi tiết thiết kế kèm ?round=", async () => {
    open();
    const links = await screen.findAllByRole("link", { name: "Xem & quyết định" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", `/admin/designs/review-queue/${D1}?round=${ROUND_ID}`);
  });

  it("hết giờ / mất kết nối: không gửi lại, tải lại vòng", async () => {
    vi.spyOn(toast, "warning").mockImplementation(() => undefined);
    const api = open({
      [approvalsUrl]: () => {
        throw apiError(0, "NETWORK_ERROR");
      },
    });
    const user = userEvent.setup();
    await runApproveAll(user);
    await waitFor(() =>
      expect(api.get.mock.calls.filter((c) => c[0] === roundUrl).length).toBeGreaterThan(1),
    );
    expect(api.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
