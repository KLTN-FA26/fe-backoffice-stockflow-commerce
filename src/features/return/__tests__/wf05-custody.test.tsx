/**
 * WF-05 Q-11 trên màn chi tiết yêu cầu trả hàng: biên nhận giữ hộ — hàng về mà phiếu nhập hàng hoàn không nhận (SKU không
 * được duyệt, vượt số duyệt, kiện về sau khi đã chốt tiền) ghi trên yêu cầu, ở mọi trạng thái; tách khỏi ảnh khiếu nại.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/test/api-screen";

import { ReturnDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom has no `crypto.subtle` on every Node version: the direct upload itself is covered by `direct-upload.test.ts`;
// here it only has to declare through the custody slot and hand back an upload id.
vi.mock("@/lib/api/direct-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/direct-upload")>()),
  uploadFileDirect: async (options: {
    file: File;
    declare: (declaration: unknown) => Promise<{ uploadId: string }>;
  }) => {
    const slot = await options.declare({
      fileName: options.file.name,
      contentType: options.file.type,
      sizeBytes: options.file.size,
      sha256: "0".repeat(64),
    });
    return slot.uploadId;
  },
}));

afterEach(() => vi.restoreAllMocks());

const SLOT = "/returns/ret-1/custody/uploads";
const slot = () => ({ uploadId: "up-9", method: "PUT", url: "/x", headers: {} });
const photo = () => new File(["abc"], "giu-ho.jpg", { type: "image/jpeg" });

const kept = () =>
  returnJson({
    status: "RESOLVED",
    evidence: [
      { id: "ev-1", stage: "CLAIM", originalName: "loi.jpg", uploadedAt: "2026-11-10T03:00:00Z" },
      {
        id: "ev-2",
        stage: "CUSTODY",
        originalName: "giu-ho.jpg",
        uploadedAt: "2026-11-20T03:00:00Z",
        custody: { sku: "SKU-OTHER", lpn: null, quantity: 4, note: "Khách nhờ gửi trả" },
      },
    ],
  });

const card = async () =>
  (await screen.findByRole("heading", { name: "Hàng giữ hộ khách" })).parentElement as HTMLElement;

describe("custody notes (WF-05 Q-11)", () => {
  it("lists what is kept apart from the claim photos, even on a resolved return", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, { get: { "/returns/ret-1": kept } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const custody = await card();
    expect(within(custody).getByText("SKU-OTHER")).toBeInTheDocument();
    expect(within(custody).getByText("Khách nhờ gửi trả")).toBeInTheDocument();
    // the accountant reads, does not record
    expect(within(custody).queryByRole("button", { name: /Ghi biên nhận/ })).toBeNull();
    // the claim card shows the claim photo only
    const claim = screen.getByRole("heading", { name: "Ảnh bằng chứng" })
      .parentElement as HTMLElement;
    expect(within(claim).getAllByRole("button", { name: "Xem ảnh" })).toHaveLength(1);
  });

  it("Sales record one on a resolved return: SKU or LPN, a photo, then slot → custody", async () => {
    const declare = vi.fn((_body: unknown) => slot());
    const add = vi.fn((_body: unknown) => kept());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": kept },
      post: {
        [SLOT]: (_p, body) => declare(body),
        "/returns/ret-1/custody": (_p, body) => add(body),
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const custody = await card();
    await user.type(within(custody).getByLabelText(/Số lượng/), "2");
    await user.click(within(custody).getByRole("button", { name: /Ghi biên nhận/ }));
    expect(
      await within(custody).findByText("Nhập SKU hoặc LPN của hàng giữ hộ"),
    ).toBeInTheDocument();
    expect(declare).not.toHaveBeenCalled();

    await user.type(within(custody).getByLabelText(/^LPN/), "LPN-7788");
    await user.click(within(custody).getByRole("button", { name: /Ghi biên nhận/ }));
    expect(await within(custody).findByText(/Chụp hoặc chọn ảnh hàng giữ hộ/)).toBeInTheDocument();
    expect(declare).not.toHaveBeenCalled();

    await user.upload(within(custody).getByLabelText(/Ảnh hàng giữ hộ/), photo());
    await user.type(within(custody).getByLabelText(/Ghi chú/), "Khách đồng ý huỷ hộ, có biên bản");
    await user.click(within(custody).getByRole("button", { name: /Ghi biên nhận/ }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        uploadId: "up-9",
        lpn: "LPN-7788",
        quantity: 2,
        note: "Khách đồng ý huỷ hộ, có biên bản",
      }),
    );
    expect(declare).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/jpeg" }));
  });

  it("BE RETURN_EVIDENCE_LIMIT_REACHED is explained in Vietnamese", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": kept },
      post: {
        [SLOT]: () => {
          throw apiError(409, "RETURN_EVIDENCE_LIMIT_REACHED");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const custody = await card();
    await user.type(within(custody).getByLabelText(/^SKU/), "SKU-OTHER");
    await user.type(within(custody).getByLabelText(/Số lượng/), "1");
    await user.upload(within(custody).getByLabelText(/Ảnh hàng giữ hộ/), photo());
    await user.click(within(custody).getByRole("button", { name: /Ghi biên nhận/ }));
    expect(await within(custody).findByText(/đủ số ảnh tối đa/)).toBeInTheDocument();
  });
});
