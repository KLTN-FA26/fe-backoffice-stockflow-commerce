import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_LABELS, REPRINT_REASON_LABELS } from "@/constants";
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

function setup(view: SampleRounds, permissions = PRODUCTION_ACTORS.coordinator) {
  const spies = mockProductionApi(permissions, {
    get: { [URL]: () => view },
    post: { [URL]: () => view },
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
