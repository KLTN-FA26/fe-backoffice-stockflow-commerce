/**
 * Audit r3 (BE r3c) trên màn trả hàng: RAD-3 hàng trên biên nhận giữ hộ có kết cục (Sale ghi lựa chọn của khách, Quản lý kho
 * ghi đã rời kho, danh sách TH-6), RAD-1 thùng giữ hộ tính theo SKU (yêu cầu có hoàn tiền vẫn có thể giữ hộ), mã lỗi mới
 * RETURN_CUSTODY_CHOICE_REQUIRED.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RMA_CUSTODY_PERMISSIONS, RMA_PERMISSIONS } from "@/constants/returns";
import { apiError } from "@/test/api-screen";

import { CustodyNotesList, ReturnDetail } from "..";
import { RETURN_ERROR_MESSAGES, returnErrorMessage } from "../errors";
import {
  SALES_GRANTS,
  WAREHOUSE_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const C = RETURN_LABELS.detail.custody;
const CHOICE = "/returns/ret-1/custody/ev-2/choice";
const END = "/returns/ret-1/custody/ev-2/end";
const MANAGER: PermissionCode[] = [
  ...WAREHOUSE_GRANTS,
  RMA_CUSTODY_PERMISSIONS.read,
  RMA_CUSTODY_PERMISSIONS.update,
];

/** Yêu cầu có biên nhận giữ hộ ev-2 (16oz về trên RMA 12oz — TH-2 bước 7), kết cục `outcome`. */
const withNote = (outcome: Record<string, unknown> | null, over: Record<string, unknown> = {}) =>
  returnJson({
    status: "RESOLVED",
    outcome: "REFUNDED",
    evidence: [
      { id: "ev-1", stage: "CLAIM", originalName: "loi.jpg", uploadedAt: "2026-11-10T03:00:00Z" },
      {
        id: "ev-2",
        stage: "CUSTODY",
        originalName: "giu-ho.jpg",
        uploadedAt: "2026-11-20T03:00:00Z",
        custody: { sku: "CUP-16OZ", lpn: null, quantity: 50, note: "Khác SKU", outcome },
      },
    ],
    custodyCartons: [],
    ...over,
  });
const custodyCard = async () =>
  (await screen.findByRole("heading", { name: C.title })).parentElement as HTMLElement;

describe("RAD-3: goods on a custody note have an ending", () => {
  it("before: no choice recorded — Sales see 'Ghi lựa chọn', the warehouse manager cannot end it yet", async () => {
    mockReturnApi(SALES_GRANTS, { get: { "/returns/ret-1": () => withNote(null) } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await custodyCard();
    expect(within(card).getByText(C.waitChoice)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: C.choose })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: C.end })).toBeNull();
  });

  it("Sales record a destruction only with the consent record, then send it", async () => {
    const api = mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => withNote(null) },
      post: { [CHOICE]: () => withNote({ choice: "DESTROY_ON_BEHALF", choiceNote: "BB-01" }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(within(await custodyCard()).getByRole("button", { name: C.choose }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Khách chọn/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Công ty huỷ hộ/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: C.choose }));
    expect(await within(dialog).findByText(C.choiceNoteRequired)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Biên bản/), "BB-01");
    await userEvent.click(within(dialog).getByRole("button", { name: C.choose }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(CHOICE, { choice: "DESTROY_ON_BEHALF", note: "BB-01" }),
    );
  });

  it("TAKEN_BY_RETURN picks a supplementary return of the same customer that still takes goods", async () => {
    const api = mockReturnApi(SALES_GRANTS, {
      get: {
        "/returns/ret-1": () => withNote(null),
        "/returns": () => ({
          items: [
            { ...row("ret-1", "RMA-0001", "RESOLVED") },
            { ...row("ret-2", "RMA-0002", "AWAITING_RETURN") },
            { ...row("ret-3", "RMA-0003", "REJECTED") },
          ],
          page: 0,
          size: 50,
          totalElements: 3,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      },
      post: {
        [CHOICE]: () => withNote({ choice: "TAKEN_BY_RETURN", takenByRmaNumber: "RMA-0002" }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(within(await custodyCard()).getByRole("button", { name: C.choose }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Khách chọn/ }));
    await userEvent.click(await screen.findByRole("option", { name: /yêu cầu trả hàng bổ sung/ }));
    // Not chosen yet → refused before anything is sent
    await userEvent.click(within(dialog).getByRole("button", { name: C.choose }));
    expect(await within(dialog).findByText(C.takenByReturnRequired)).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("combobox", { name: new RegExp(C.takenByReturn) }),
    );
    const options = await screen.findAllByRole("option");
    // Itself and a rejected return are not offered
    expect(options.map((option) => option.textContent)).toEqual(["RMA-0002"]);
    await userEvent.click(options[0]!);
    await userEvent.click(within(dialog).getByRole("button", { name: C.choose }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(CHOICE, {
        choice: "TAKEN_BY_RETURN",
        takenByReturnId: "ret-2",
      }),
    );
    const listCall = api.get.mock.calls.find(([url]) => url === "/returns");
    const params = (listCall?.[1] as { params?: URLSearchParams } | undefined)?.params;
    expect(params?.get("customerId")).toBe("cus-1");
  });

  it("the warehouse manager ends a chosen note with its record; the 409 'choice required' reads in Vietnamese", async () => {
    const api = mockReturnApi(MANAGER, {
      get: {
        "/returns/ret-1": () =>
          withNote({ choice: "SEND_BACK", chosenAt: "2026-11-21T02:00:00Z", endedAt: null }),
      },
      post: {
        [END]: () => {
          throw apiError(409, "RETURN_CUSTODY_CHOICE_REQUIRED");
        },
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await custodyCard();
    // Recording the choice is Sales' work: the warehouse has no such button
    expect(within(card).queryByRole("button", { name: /lựa chọn/ })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: C.end }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "BB giao trả 21/11");
    await userEvent.click(within(dialog).getByRole("button", { name: C.end }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(END, { note: "BB giao trả 21/11" }));
    expect(
      await within(dialog).findByText(RETURN_ERROR_MESSAGES.RETURN_CUSTODY_CHOICE_REQUIRED!),
    ).toBeInTheDocument();
  });

  it("an ended note shows when it left and offers nothing more", async () => {
    mockReturnApi([...MANAGER, RMA_PERMISSIONS.update], {
      get: {
        "/returns/ret-1": () =>
          withNote({
            choice: "SEND_BACK",
            chosenAt: "2026-11-21T02:00:00Z",
            endedAt: "2026-11-22T02:00:00Z",
            endedNote: "BB-GT-07",
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await custodyCard();
    expect(within(card).getByText(/BB-GT-07/)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: C.end })).toBeNull();
    expect(within(card).queryByRole("button", { name: C.changeChoice })).toBeNull();
  });
});

describe("RAD-3 (TH-6): the list of goods kept on custody notes", () => {
  it("lists what the warehouse keeps, oldest first, with the ending action; nothing without sales-rma-custody:READ", async () => {
    const api = mockReturnApi(MANAGER, {
      get: {
        "/returns/custody-notes": () => ({
          items: [
            {
              evidenceId: "ev-2",
              returnRequestId: "ret-1",
              rmaNumber: "RMA-0001",
              customerId: "cus-1",
              sku: "CUP-16OZ",
              quantity: 50,
              keptAt: "2026-11-20T03:00:00Z",
              choice: "DESTROY_ON_BEHALF",
              choiceNote: "BB-01",
            },
          ],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      },
    });
    renderReturnScreen(<CustodyNotesList />);
    expect(await screen.findByRole("link", { name: "RMA-0001" })).toBeInTheDocument();
    expect(screen.getByText("CUP-16OZ × 50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: C.end })).toBeInTheDocument();
    const call = api.get.mock.calls.find(([url]) => url === "/returns/custody-notes");
    const params = (call?.[1] as { params?: URLSearchParams } | undefined)?.params;
    expect(params?.get("ended")).toBe("false");
  });

  it("audit r3 CF-7: a warehouse manager without sales-rmas:READ sees the RMA number, not a link that answers 403", async () => {
    mockReturnApi(
      MANAGER.filter((code) => code !== RMA_PERMISSIONS.read),
      {
        get: {
          "/returns/custody-notes": () => ({
            items: [
              {
                evidenceId: "ev-2",
                returnRequestId: "ret-1",
                rmaNumber: "RMA-0001",
                customerId: "cus-1",
                sku: "CUP-16OZ",
                quantity: 50,
                keptAt: "2026-11-20T03:00:00Z",
                choice: "DESTROY_ON_BEHALF",
                choiceNote: "BB-01",
              },
            ],
            page: 0,
            size: 50,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          }),
        },
      },
    );
    renderReturnScreen(<CustodyNotesList />);
    expect(await screen.findByText("RMA-0001")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "RMA-0001" })).toBeNull();
    // Việc của Quản lý kho vẫn làm được ngay trên dòng
    expect(screen.getByRole("button", { name: C.end })).toBeInTheDocument();
  });

  it("is not shown without the read permission", async () => {
    const api = mockReturnApi(SALES_GRANTS, {});
    renderReturnScreen(<CustodyNotesList />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText(RETURN_LABELS.detail.custodyNotes.title)).toBeNull();
    expect(api.get.mock.calls.some(([url]) => url === "/returns/custody-notes")).toBe(false);
  });
});

describe("RAD-1: cartons settle per SKU — a refunded return can still hold cartons", () => {
  it("12oz refunded, 16oz refused: the 16oz carton is held and Sales record the customer's choice", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          returnJson({
            status: "RESOLVED",
            outcome: "REFUNDED",
            refusalReason: "CUSTOMER_DAMAGE",
            custodyCartons: [
              {
                lpn: "LPN-16OZ",
                sku: "CUP-16OZ",
                quantity: 50,
                locationCode: "WH1-QC01",
                ownership: "CUSTOMER_HELD",
              },
            ],
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = (
      await screen.findByRole("heading", { name: RETURN_LABELS.detail.custodyChoice.title })
    ).parentElement?.parentElement as HTMLElement;
    expect(within(card).getByText("LPN-16OZ")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: RETURN_LABELS.detail.custodyChoice.record }),
    ).toBeInTheDocument();
  });
});

describe("the new error code reads in Vietnamese", () => {
  it("RETURN_CUSTODY_CHOICE_REQUIRED", () => {
    const sentence = RETURN_ERROR_MESSAGES.RETURN_CUSTODY_CHOICE_REQUIRED;
    expect(sentence).toContain("Sale chưa ghi lựa chọn của khách");
    expect(
      returnErrorMessage(apiError(409, "RETURN_CUSTODY_CHOICE_REQUIRED", undefined, "en")),
    ).toBe(sentence);
  });
});

function row(id: string, rmaNumber: string, status: string) {
  return {
    id,
    rmaNumber,
    orderId: "ord-1",
    orderNumber: "SO-1",
    customerId: "cus-1",
    status,
    reasonCode: "PRINT_DEFECT",
    channel: "PORTAL",
    requestedAt: "2026-11-10T03:00:00Z",
    currency: "VND",
    vatAdjustmentRequired: false,
    version: 1,
  };
}
