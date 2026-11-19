/**
 * Thẻ file đính kèm dùng chung (file vận đơn của chuyến, POD của lô giao; docs 09 §4.4, §4.3 bước 2, BR-28): danh sách, rỗng,
 * lỗi tải danh sách, tải lên ba bước, từ chối ở máy, lỗi BE bằng tiếng Việt, tải xuống bằng link ngắn hạn, gate quyền / trạng thái.
 */
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_FILE_LABELS as L, SHIPPING_FILE_MAX_BYTES } from "@/constants/shipping-files";
import { storageClient } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";

import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../../__fixtures__/render";
import { AttachedFilesCard } from "./AttachedFilesCard";

import type { ShippingFileKind } from "@/constants/shipping-files";

// Màn có nhiều truy vấn nối tiếp (quyền → chuyến → file): chờ lâu hơn 1 s mặc định khi máy tải nặng
configure({ asyncUtilTimeout: 5000 });

afterEach(() => vi.restoreAllMocks());

/** SHA-256("abc"). */
const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const LOAD = "ld-1";
const SHIPMENT = "sh-1";
const BASE = {
  waybill: `/fulfillment/loads/${LOAD}/waybill-files`,
  pod: `/fulfillment/shipments/${SHIPMENT}/pod-files`,
} as const;
const OWNER = { waybill: LOAD, pod: SHIPMENT } as const;
const STORAGE_URL = "https://bucket.s3.amazonaws.com/incoming/u-1?X-Amz-Signature=SECRET";
const DOWNLOAD_URL = "https://bucket.s3.amazonaws.com/documents/x.pdf?X-Amz-Signature=SECRET";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const file = (patch: Record<string, unknown> = {}) => ({
  fileId: "11111111-1111-4111-8111-111111111111",
  fileName: "van-don-hang-NB.pdf",
  contentType: "application/pdf",
  sizeBytes: 48213,
  uploadedBy: "33333333-3333-4333-8333-333333333333",
  uploadedAt: "2026-11-17T13:24:10Z",
  ...patch,
});
const pdf = (name = "xac-nhan.pdf") => new File(["abc"], name, { type: "application/pdf" });
const apiError = (status: number, code: string) =>
  new ApiError(status, code, "English server message", undefined, "trace-1");

interface Setup {
  kind?: ShippingFileKind;
  canUpload?: boolean;
  blocked?: string | null;
  listed?: unknown[] | (() => unknown);
  attach?: (body: unknown) => unknown;
  slot?: () => unknown;
}

function renderCard({ kind = "waybill", canUpload = true, blocked, ...routes }: Setup = {}) {
  const base = BASE[kind];
  const listed = routes.listed ?? [];
  const spies = mockShippingApi(ACTORS.warehouseStaff, {
    get: {
      [base]: typeof listed === "function" ? listed : () => listed,
      [`${base}/${file().fileId}/download-url`]: () => ({
        url: DOWNLOAD_URL,
        expiresAt: "2026-11-17T13:34:10Z",
      }),
    },
    post: {
      [`${base}/uploads`]: () =>
        routes.slot?.() ?? {
          uploadId: "u-1",
          method: "PUT",
          url: STORAGE_URL,
          headers: { "Content-Type": "application/pdf" },
        },
      [base]: (_p, body) => routes.attach?.(body) ?? file({ fileName: "xac-nhan.pdf" }),
    },
  });
  renderShippingScreen(
    <AttachedFilesCard
      kind={kind}
      ownerId={OWNER[kind]}
      canUpload={canUpload}
      uploadBlockedReason={blocked}
    />,
  );
  return spies;
}

const input = () => document.querySelector<HTMLInputElement>("input[type='file']");
const fileInput = (): HTMLInputElement => {
  const el = input();
  if (!el) throw new Error("Không có ô chọn file");
  return el;
};

describe("AttachedFilesCard — danh sách", () => {
  it("file vận đơn: tiêu đề kèm số file; tên, loại, dung lượng, thời điểm; không hiện uuid người tải", async () => {
    renderCard({
      listed: [
        file(),
        file({
          fileId: "22222222-2222-4222-8222-222222222222",
          fileName: "bang-ke.xlsx",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 5 * 1024 * 1024,
        }),
      ],
    });
    expect(
      await screen.findByRole("heading", { name: `${L.waybill.title} (2)` }),
    ).toBeInTheDocument();
    const row = within(screen.getByText("van-don-hang-NB.pdf").closest("tr") as HTMLElement);
    expect(row.getByText("PDF")).toBeInTheDocument();
    expect(row.getByText("47 KB")).toBeInTheDocument();
    expect(row.getByText(/thg 11, 2026/)).toBeInTheDocument();
    const second = within(screen.getByText("bang-ke.xlsx").closest("tr") as HTMLElement);
    expect(second.getByText("Excel")).toBeInTheDocument();
    expect(second.getByText("5,0 MB")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(UUID);
  });

  it("POD: tiêu đề và mô tả của biên bản giao nhận", async () => {
    renderCard({
      kind: "pod",
      listed: [file({ fileName: "bien-ban.png", contentType: "image/png" })],
    });
    expect(await screen.findByRole("heading", { name: `${L.pod.title} (1)` })).toBeInTheDocument();
    expect(screen.getByText(L.pod.description)).toBeInTheDocument();
    expect(screen.getByText("Ảnh PNG")).toBeInTheDocument();
  });

  it.each([
    ["waybill", L.waybill.empty],
    ["pod", L.pod.empty],
  ] as const)("%s: chưa có file → câu trạng thái rỗng, không có bảng", async (kind, empty) => {
    renderCard({ kind });
    expect(await screen.findByText(empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tải danh sách lỗi → câu tiếng Việt + Thử lại tải lại được", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderCard({
      listed: () => {
        if (fail) throw apiError(500, "INTERNAL_ERROR");
        return [file()];
      },
    });
    expect(await screen.findByText(new RegExp(L.common.loadFailed))).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: L.common.retry }));
    expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
  });
});

describe("AttachedFilesCard — tải lên", () => {
  it("chọn file: băm → xin slot (khai báo đúng) → PUT lên kho → gắn bằng uploadId → làm mới danh sách → báo đã đính kèm", async () => {
    const user = userEvent.setup();
    let attached = false;
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const spies = renderCard({
      listed: () => (attached ? [file({ fileName: "xac-nhan.pdf" })] : []),
      attach: () => {
        attached = true;
        return file({ fileName: "xac-nhan.pdf" });
      },
    });
    await screen.findByText(L.waybill.empty);
    const chosen = pdf();
    await user.upload(fileInput(), chosen);

    expect(await screen.findByText(L.common.uploaded("xac-nhan.pdf"))).toBeInTheDocument();
    expect(spies.post).toHaveBeenCalledWith(
      `${BASE.waybill}/uploads`,
      { fileName: "xac-nhan.pdf", contentType: "application/pdf", sizeBytes: 3, sha256: ABC },
      expect.anything(),
    );
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PUT", url: STORAGE_URL, data: chosen }),
    );
    expect(spies.post).toHaveBeenCalledWith(BASE.waybill, { uploadId: "u-1" }, expect.anything());
    // danh sách được tải lại và hiện file mới
    expect(await screen.findByText("xac-nhan.pdf", { selector: "td span" })).toBeInTheDocument();
    // link kho (thông tin xác thực) không bao giờ ra màn hình
    expect(document.body.textContent).not.toContain("SECRET");
  });

  it("kéo thả file vào hộp tải lên cũng tải lên (đúng ba bước)", async () => {
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const spies = renderCard();
    await screen.findByText(L.waybill.empty);
    const box = fileInput().parentElement as HTMLElement;
    const dropped = pdf("keo-tha.pdf");
    fireEvent.dragOver(box, { dataTransfer: { types: ["Files"], files: [dropped] } });
    fireEvent.drop(box, { dataTransfer: { types: ["Files"], files: [dropped] } });
    expect(await screen.findByText(L.common.uploaded("keo-tha.pdf"))).toBeInTheDocument();
    expect(spies.post).toHaveBeenCalledWith(
      `${BASE.waybill}/uploads`,
      expect.objectContaining({ fileName: "keo-tha.pdf" }),
      expect.anything(),
    );
    expect(put).toHaveBeenCalledWith(expect.objectContaining({ data: dropped }));
  });

  it("file vận đơn nhận Excel; POD từ chối Excel ngay ở máy và không gọi BE", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const xlsx = new File(["x"], "bang-ke.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const spies = renderCard({ kind: "pod" });
    await screen.findByText(L.pod.empty);
    await user.upload(fileInput(), xlsx);
    expect(await screen.findByRole("alert")).toHaveTextContent(L.pod.typeNotAccepted);
    expect(spies.post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("loại lạ và file quá 25 MB bị chặn ở máy, câu tiếng Việt, không gọi BE", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const spies = renderCard();
    await screen.findByText(L.waybill.empty);
    await user.upload(fileInput(), new File(["x"], "ghi-chu.txt", { type: "text/plain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(L.waybill.typeNotAccepted);

    const big = pdf("lon.pdf");
    Object.defineProperty(big, "size", { value: SHIPPING_FILE_MAX_BYTES + 1 });
    await user.upload(fileInput(), big);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(L.common.fileProblem.tooLarge),
    );
    expect(spies.post).not.toHaveBeenCalled();
  });

  it("BE từ chối khi xin slot (409 SHIPMENT_STATE_CONFLICT) → câu tiếng Việt, không lộ message tiếng Anh, không PUT", async () => {
    const user = userEvent.setup();
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    renderCard({
      kind: "pod",
      slot: () => {
        throw apiError(409, "SHIPMENT_STATE_CONFLICT");
      },
    });
    await screen.findByText(L.pod.empty);
    await user.upload(fileInput(), pdf());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(L.pod.stateConflict);
    expect(alert).not.toHaveTextContent("English server message");
    expect(put).not.toHaveBeenCalled();
  });

  it("kho từ chối PUT → câu tiếng Việt, không gắn file", async () => {
    const user = userEvent.setup();
    vi.spyOn(storageClient, "request").mockRejectedValue({ response: { status: 403 } });
    const spies = renderCard();
    await screen.findByText(L.waybill.empty);
    await user.upload(fileInput(), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent(L.common.error.storageRefused);
    expect(spies.post).not.toHaveBeenCalledWith(BASE.waybill, expect.anything(), expect.anything());
  });

  it("gắn file bị BE từ chối (400 VALIDATION_FAILED) → câu tiếng Việt của từng loại file", async () => {
    const user = userEvent.setup();
    vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    renderCard({
      attach: () => {
        throw apiError(400, "VALIDATION_FAILED");
      },
    });
    await screen.findByText(L.waybill.empty);
    await user.upload(fileInput(), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent(L.waybill.rejected);
  });
});

describe("AttachedFilesCard — tải xuống", () => {
  it("bấm Tải xuống hỏi link mới rồi mở link; link không hiện trên màn", async () => {
    const user = userEvent.setup();
    const opened: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      opened.push(this.href);
    });
    const spies = renderCard({ listed: [file()] });
    await user.click(
      await screen.findByRole("button", { name: `${L.common.download} van-don-hang-NB.pdf` }),
    );
    await waitFor(() => expect(opened).toEqual([DOWNLOAD_URL]));
    // Link hỏi lại mỗi lần bấm (không lưu): đúng một lần gọi download-url của file này
    const linkCalls = spies.get.mock.calls.filter(
      ([url]) => url === `${BASE.waybill}/${file().fileId}/download-url`,
    );
    expect(linkCalls).toHaveLength(1);
    expect(document.body.textContent).not.toContain("SECRET");
  });

  it("không lấy được link → báo tiếng Việt, không mở gì", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderCard({ listed: [file({ fileId: "99999999-9999-4999-8999-999999999999" })] });
    await user.click(await screen.findByRole("button", { name: /Tải xuống/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(L.common.error.openFailed);
    expect(click).not.toHaveBeenCalled();
  });
});

describe("AttachedFilesCard — gate quyền và trạng thái", () => {
  it("không có quyền tải lên: ẩn hộp tải lên, vẫn xem và tải xuống được, có câu giải thích", async () => {
    renderCard({ canUpload: false, listed: [file()] });
    expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
    expect(input()).toBeNull();
    expect(screen.getByText(L.common.viewOnly)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải xuống/ })).toBeInTheDocument();
  });

  it("trạng thái chưa cho tải lên: hiện lý do tiếng Việt thay hộp tải lên (kể cả khi có quyền)", async () => {
    renderCard({ kind: "pod", blocked: L.pod.notDelivered });
    expect(await screen.findByText(L.pod.notDelivered)).toBeInTheDocument();
    expect(input()).toBeNull();
    expect(await screen.findByText(L.pod.empty)).toBeInTheDocument();
  });

  it("có quyền và được phép: hiện hộp tải lên với gợi ý loại file / dung lượng", async () => {
    renderCard({ kind: "pod" });
    await screen.findByText(L.pod.empty);
    expect(input()).not.toBeNull();
    expect(input()).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png");
    expect(screen.getByText(new RegExp(L.pod.typeHint))).toBeInTheDocument();
  });
});
