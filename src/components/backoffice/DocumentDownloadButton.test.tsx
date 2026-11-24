import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { renderScreen } from "@/test/api-screen";

import { DocumentDownloadButton } from "./DocumentDownloadButton";

const saveFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/file-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/file-download")>()),
  saveFile,
}));

afterEach(() => {
  vi.restoreAllMocks();
  saveFile.mockReset();
});

const NAME = "Phiếu hoàn tiền PHT-261123-a1b2c3.pdf";

function mockGet(grants: string[], file: () => unknown) {
  return vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/me/permissions")
      return { data: { roles: [], permissions: grants, dataScope: "ALL" } };
    return file();
  });
}

const button = (
  <DocumentDownloadButton kind="refundConfirmation" path="/refunds/records/rec-1/confirmation" />
);

describe("DocumentDownloadButton (giấy tờ WF-05)", () => {
  it("vai không có quyền của endpoint không thấy nút", async () => {
    const get = mockGet(["payment-installments:READ"], () => ({ data: new Blob() }));
    renderScreen(button, "SALES_MANAGER");
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: /Tải phiếu hoàn tiền/ })).not.toBeInTheDocument();
  });

  it("tải PDF và lưu đúng tên BE đặt (filename* UTF-8)", async () => {
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    const get = mockGet(["payment-refunds:READ"], () => ({
      data: pdf,
      headers: {
        "content-disposition": `inline; filename="x"; filename*=UTF-8''${encodeURIComponent(NAME)}`,
      },
    }));
    renderScreen(button, "SALES_MANAGER");
    await userEvent.click(await screen.findByRole("button", { name: /Tải phiếu hoàn tiền/ }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith({ blob: pdf, fileName: NAME }));
    expect(get).toHaveBeenCalledWith(
      "/refunds/records/rec-1/confirmation",
      expect.objectContaining({ responseType: "blob" }),
    );
  });

  it.each([
    [403, "FORBIDDEN", "Bạn không có quyền tải phiếu hoàn tiền."],
    [404, "REFUND_RECORD_NOT_FOUND", "Không tìm thấy ghi nhận hoàn tiền này."],
    [
      409,
      "REFUND_RECORD_ALREADY_VOIDED",
      "Ghi nhận hoàn tiền này đã bị huỷ nên không in phiếu hoàn tiền.",
    ],
  ])("lỗi %s %s → câu tiếng Việt dưới nút", async (status, code, message) => {
    mockGet(["payment-refunds:READ"], () => {
      throw new ApiError(status, code, code);
    });
    renderScreen(button, "SALES_MANAGER");
    await userEvent.click(await screen.findByRole("button", { name: /Tải phiếu hoàn tiền/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(saveFile).not.toHaveBeenCalled();
  });
});
