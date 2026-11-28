import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_LABELS, REPRINT_REASON_LABELS } from "@/constants";
import { uploadFileDirect } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { SampleRoundsCard } from "../components/sample/SampleRoundsCard";
import { PRODUCTION_ACTORS, productionOrder } from "../__fixtures__/production-order";
import { sampleRound, sampleRounds } from "../__fixtures__/sample-rounds";

import type { SampleRounds } from "../sample-schemas";

// Bước băm + PUT lên kho lưu trữ có test riêng (`lib/api/direct-upload.test.ts`) — ở đây chỉ cần uploadId.
vi.mock("@/lib/api/direct-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/direct-upload")>()),
  uploadFileDirect: vi.fn(async () => "upload-1"),
}));

const S = PRODUCTION_LABELS.sample;
const order = productionOrder({ status: "SAMPLE_PENDING" });
const URL = `/production-orders/${order.id}/sample-rounds`;

const ADD_URL = `${URL}/round-1/media`;

function setup(
  view: SampleRounds,
  permissions = PRODUCTION_ACTORS.coordinator,
  addMedia: () => unknown = () => view,
) {
  const spies = mockProductionApi(permissions, {
    get: { [URL]: () => view },
    post: { [URL]: () => view, [ADD_URL]: addMedia },
  });
  renderProductionScreen(<SampleRoundsCard order={{ ...order, status: view.status }} />);
  return spies;
}

afterEach(() => vi.restoreAllMocks());

describe("SampleRoundsCard (docs 17 §4.3 bước 9)", () => {
  it("khách yêu cầu in lại → mở vòng mới bắt buộc lý do, gửi uploadIds + lý do", async () => {
    const user = userEvent.setup();
    const view = sampleRounds({
      waitingRoundId: null,
      rounds: [sampleRound({ result: "REPRINT_REQUESTED", customerNote: "Logo lệch trái" })],
    });
    const { post } = setup(view);
    expect(await screen.findByText(/Logo lệch trái/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: S.openNext }));
    const dialog = await screen.findByRole("dialog");
    await user.upload(
      within(dialog).getByLabelText(new RegExp(S.files)),
      new File(["x"], "vong-2.jpg", { type: "image/jpeg" }),
    );
    const submit = within(dialog).getByRole("button", { name: S.submitOpen });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByLabelText(new RegExp(REPRINT_REASON_LABELS.PRINT_DEFECT)));
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(URL, {
        uploadIds: ["upload-1"],
        reprintReason: "PRINT_DEFECT",
      }),
    );
  });

  it("nút Mở vòng khoá → một dòng nói còn thiếu gì: tệp, rồi lý do in lại (S11-9)", async () => {
    const user = userEvent.setup();
    setup(
      sampleRounds({
        waitingRoundId: null,
        rounds: [sampleRound({ result: "REPRINT_REQUESTED", customerNote: "Logo lệch" })],
      }),
    );
    await user.click(await screen.findByRole("button", { name: S.openNext }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(S.missingFile)).toBeInTheDocument();
    await user.upload(
      within(dialog).getByLabelText(new RegExp(S.files)),
      new File(["x"], "vong-2.jpg", { type: "image/jpeg" }),
    );
    // Đã có tệp (tên hiện trong danh sách) → còn thiếu lý do in lại
    expect(within(dialog).getByText("vong-2.jpg")).toBeInTheDocument();
    expect(within(dialog).queryByText(S.missingFile)).toBeNull();
    expect(within(dialog).getByText(S.missingReason)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText(new RegExp(REPRINT_REASON_LABELS.PRINT_DEFECT)));
    expect(within(dialog).queryByText(S.missingReason)).toBeNull();
  });

  it.each([
    [
      "mất phản hồi → gửi lại đúng uploadId cũ, không tải lại (BE replay)",
      new ApiError(0, "NETWORK_ERROR", "x"),
      1,
    ],
    ["BE từ chối (4xx) → lần sau tải tệp mới", new ApiError(409, "CONFLICT", "x"), 2],
  ])("thêm tệp lỗi: %s", async (_name, failure, uploads) => {
    const user = userEvent.setup();
    vi.mocked(uploadFileDirect).mockClear();
    const view = sampleRounds();
    const addMedia = vi.fn<() => unknown>().mockImplementationOnce(() => {
      throw failure;
    });
    addMedia.mockImplementation(() => view);
    setup(view, PRODUCTION_ACTORS.coordinator, addMedia);
    await user.click(await screen.findByRole("button", { name: S.addMedia }));
    const dialog = await screen.findByRole("dialog");
    await user.upload(
      within(dialog).getByLabelText(new RegExp(S.files)),
      new File(["x"], "them.jpg", { type: "image/jpeg" }),
    );
    await user.click(within(dialog).getByRole("button", { name: S.submitAdd }));
    await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1));
    await user.click(await within(dialog).findByRole("button", { name: S.submitAdd }));
    await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(2));
    expect(uploadFileDirect).toHaveBeenCalledTimes(uploads);
  });

  it("vượt số lần in mẫu miễn phí → cảnh báo, vẫn thao tác được", async () => {
    setup(sampleRounds({ countedRounds: 3, freeRoundsExceeded: true }));
    expect(await screen.findByText(S.freeExceeded)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: S.addMedia })).toBeInTheDocument();
  });

  it("Sale chỉ xem vòng mẫu, không có nút thao tác", async () => {
    setup(sampleRounds(), PRODUCTION_ACTORS.sales);
    expect(await screen.findByText(S.round(1))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: S.addMedia })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: S.recordPhysical })).not.toBeInTheDocument();
  });
});
