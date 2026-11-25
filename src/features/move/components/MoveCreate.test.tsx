import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PUTAWAY_DETAIL_LABELS } from "@/constants";
import {
  MOVE_API,
  MOVE_ERROR_MESSAGES,
  MOVE_LABELS,
  MOVE_MESSAGES,
  MOVE_SUGGESTION_LIST_LABELS,
} from "@/constants/move";
import {
  INVENTORY_PERMISSIONS,
  STOCK_PACKAGE_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
} from "@/constants/permissions";

import { useMyPermissions } from "@/lib/auth";

import {
  failure,
  MOVE_TAB_WAREHOUSE,
  moveEndpoint,
  movePermissions,
  renderMove,
  setMoveTestActor,
} from "../test-support";
import { MoveCreate } from "./MoveCreate";

import type { DestinationMap, DestinationMapProps } from "./destination-map";

const server = setupServer();
const moveUrl = moveEndpoint(MOVE_API.move);
const cartonUrl = moveEndpoint("/inventory/stock-packages/:lpn");
const cartonsUrl = moveEndpoint(MOVE_API.cartons);
const suggestionsUrl = moveEndpoint(MOVE_API.binSuggestions);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stockUpdate = INVENTORY_PERMISSIONS.stockUpdate;
const cartonRead = STOCK_PACKAGE_PERMISSIONS.read;

const LPN_1 = "LPN-20261109-000001";
const LPN_2 = "LPN-20261109-000002";

/** BE `StockPackageDetailResponse` của một thùng trong kho HCM. */
function carton(lpn: string, patch: Record<string, unknown> = {}) {
  return {
    lpn,
    sku: "SOFA-3S-GREY",
    unitOfMeasure: "CARTON",
    nominalQty: 10,
    receivedQty: 10,
    lotNumber: "LOT-7",
    onHand: 10,
    reserved: 0,
    status: "IN_STOCK",
    locationCode: "HCM-A01-1-A",
    contents: [],
    ...patch,
  };
}

/** GET /inventory/stock-packages/{lpn}: thùng theo bảng, LPN lạ → 404. */
function cartons(table: Record<string, Record<string, unknown>>) {
  return http.get(cartonUrl, ({ params }) => {
    const found = table[String(params.lpn)];
    return found
      ? HttpResponse.json({ success: true, data: found })
      : failure(404, "STOCK_PACKAGE_NOT_FOUND");
  });
}

/** GET …/bin-suggestions (BE #412): ghi lại LPN của từng lần hỏi (`lpn` lặp lại trên query). */
function suggestionsReply(reply: (lpns: string[]) => unknown, asked: string[][] = []) {
  return http.get(suggestionsUrl, ({ request }) => {
    const lpns = new URL(request.url).searchParams.getAll("lpn");
    asked.push(lpns);
    return HttpResponse.json({ success: true, data: reply(lpns) });
  });
}

function moved(body: Record<string, unknown>) {
  const lpns = Array.isArray(body.lpns) ? body.lpns : [];
  return HttpResponse.json(
    {
      success: true,
      data: lpns.map((lpn) => ({
        lpn,
        sku: "SOFA-3S-GREY",
        unitOfMeasure: "CARTON",
        quantity: 10,
        locationCode: body.toLocation,
        status: "IN_STOCK",
      })),
    },
    { status: 201 },
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.clear();
  setMoveTestActor();
  server.use(
    // Trước `/stock-packages/:lpn`: MSW lấy handler khớp đầu tiên. Mặc định không có bin gợi ý.
    suggestionsReply(() => ({ suggestions: [], overflowAreas: [] })),
    movePermissions([stockUpdate, cartonRead]),
    cartons({ [LPN_1]: carton(LPN_1), [LPN_2]: carton(LPN_2, { locationCode: "HCM-A01-1-B" }) }),
    // Bộ tìm thùng gọi khi gõ; mặc định không có gì
    http.get(cartonsUrl, () =>
      HttpResponse.json({ success: true, data: { items: [], hasNext: false } }),
    ),
  );
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const submit = () => screen.getByRole("button", { name: MOVE_LABELS.submit });
const scanInput = () => screen.getByLabelText(MOVE_LABELS.scan);
const destination = () => screen.getByLabelText(/Đến vị trí/);
const cartonList = () => screen.getByRole("region", { name: MOVE_LABELS.cartonsTitle });

/** Trang Di chuyển nội bộ: form nằm trong modal mở từ nút "Tạo lệnh di chuyển" của toolbar. */
async function openMove(destinationMap?: DestinationMap) {
  renderMove(<MoveCreate destinationMap={destinationMap} />);
  await userEvent.click(await screen.findByRole("button", { name: MOVE_LABELS.formTitle }));
  await screen.findByLabelText(MOVE_LABELS.scan);
}

async function scan(lpn: string) {
  await userEvent.type(scanInput(), `${lpn}{Enter}`);
}

async function scanAndPick(lpns: string[], to = "HCM-PACK01") {
  for (const lpn of lpns) {
    await scan(lpn);
    await within(cartonList()).findByText(lpn);
  }
  if (to) await userEvent.type(destination(), to);
}

function PermissionsReady() {
  return useMyPermissions().isPending ? null : <p>permissions-ready</p>;
}

describe("move form — permission gate", () => {
  it("has no create button without the BE guard permission (inventory-stock-items:UPDATE)", async () => {
    server.use(movePermissions([INVENTORY_PERMISSIONS.movementRead, cartonRead]));
    renderMove(
      <>
        <MoveCreate />
        <PermissionsReady />
      </>,
    );
    expect(await screen.findByText("permissions-ready")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MOVE_LABELS.formTitle })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(MOVE_LABELS.scan)).not.toBeInTheDocument();
  });
});

describe("move form — scan cartons by LPN (docs 11 §4.1)", () => {
  it("shows SKU, lot, count and current location of each scanned carton; no source / quantity field", async () => {
    await openMove();
    await scan(LPN_1.toLowerCase());
    const row = (await within(cartonList()).findByText(LPN_1)).closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("SOFA-3S-GREY")).toBeInTheDocument();
    expect(cells.getByText("LOT-7")).toBeInTheDocument();
    expect(cells.getByText("10")).toBeInTheDocument();
    expect(cells.getByText("HCM-A01-1-A")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Số lượng/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Từ vị trí/)).not.toBeInTheDocument();
    expect(scanInput()).toHaveValue("");
  });

  it.each([
    ["held for an order (BR-05)", { reserved: 2 }, MOVE_MESSAGES.held(LPN_1)],
    ["not in stock (BR-04)", { status: "RECEIVING" }, MOVE_MESSAGES.notInStock(LPN_1, "RECEIVING")],
    [
      "in another warehouse (BR-01)",
      { locationCode: "HN-A01-1-A" },
      MOVE_MESSAGES.cartonOtherWarehouse(LPN_1, "HCM"),
    ],
  ])("refuses a carton %s and does not add it", async (_label, patch, message) => {
    server.use(cartons({ [LPN_1]: carton(LPN_1, patch) }));
    await openMove();
    await scan(LPN_1);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(within(cartonList()).queryByText(LPN_1)).not.toBeInTheDocument();
    expect(within(cartonList()).getByText(MOVE_LABELS.cartonsEmpty)).toBeInTheDocument();
  });

  it("an unknown LPN is not added; the same carton twice stays once", async () => {
    await openMove();
    await scan("LPN-NOPE");
    expect(await screen.findByText(MOVE_MESSAGES.notFound("LPN-NOPE"))).toBeInTheDocument();
    await scan(LPN_1);
    await within(cartonList()).findByText(LPN_1);
    await scan(LPN_1);
    expect(await screen.findByText(MOVE_MESSAGES.duplicate(LPN_1))).toBeInTheDocument();
    expect(within(cartonList()).getAllByText(LPN_1)).toHaveLength(1);
  });

  it("without inventory-stock-packages:READ the LPN is added unchecked, the BE checks it on send", async () => {
    const looked = vi.fn();
    server.use(
      movePermissions([stockUpdate]),
      http.get(cartonUrl, () => {
        looked();
        return failure(500, "UNEXPECTED");
      }),
    );
    await openMove();
    await scan(LPN_1);
    expect(await screen.findByText(MOVE_MESSAGES.addedUnverified(LPN_1))).toBeInTheDocument();
    expect(within(cartonList()).getByText(MOVE_LABELS.unverified)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: MOVE_LABELS.finderTitle })).not.toBeInTheDocument();
    expect(looked).not.toHaveBeenCalled();
  });

  it("removes a carton from the list", async () => {
    await openMove();
    await scanAndPick([LPN_1, LPN_2]);
    await userEvent.click(screen.getByRole("button", { name: MOVE_LABELS.remove(LPN_1) }));
    expect(within(cartonList()).queryByText(LPN_1)).not.toBeInTheDocument();
    expect(within(cartonList()).getByText(LPN_2)).toBeInTheDocument();
  });
});

describe("move form — submit", () => {
  it("sends only { requestId, lpns, toLocation } and shows each carton's new place", async () => {
    const sent = vi.fn();
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent(body);
        return moved(body);
      }),
    );
    await openMove();
    await scanAndPick([LPN_1, LPN_2], "hcm-pack01");
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByText(MOVE_LABELS.resultSummary(2, "HCM-PACK01"))).toBeInTheDocument();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0]?.[0]).toEqual({
      requestId: expect.stringMatching(UUID),
      lpns: [LPN_1, LPN_2],
      toLocation: "HCM-PACK01",
    });
    // Sẵn sàng cho lệnh kế tiếp
    expect(within(cartonList()).getByText(MOVE_LABELS.cartonsEmpty)).toBeInTheDocument();
    expect(destination()).toHaveValue("");
  });

  it("blocks a destination where a carton already is (BE 422), and one outside the tab warehouse", async () => {
    const sent = vi.fn();
    server.use(
      http.post(moveUrl, async ({ request }) => {
        sent(await request.json());
        return failure(500, "UNEXPECTED");
      }),
    );
    await openMove();
    await scanAndPick([LPN_1], "HCM-A01-1-A");
    expect(await screen.findByText(MOVE_MESSAGES.alreadyThere(LPN_1))).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    await userEvent.clear(destination());
    await userEvent.type(destination(), "HN-PACK01");
    expect(await screen.findByText(MOVE_MESSAGES.otherWarehouse("HCM"))).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    expect(sent).not.toHaveBeenCalled();
  });

  it("no carton → nothing to send", async () => {
    await openMove();
    await userEvent.type(destination(), "HCM-PACK01");
    expect(submit()).toBeDisabled();
  });
});

describe("move form — BE errors in Vietnamese", () => {
  it.each([
    ["STOCK_PACKAGE_HELD", 409, MOVE_ERROR_MESSAGES.cartonHeld],
    ["STOCK_SLOT_UNDER_COUNT", 409, MOVE_ERROR_MESSAGES.slotUnderCount],
    ["INVALID_STOCK_PACKAGE_TRANSITION", 409, MOVE_ERROR_MESSAGES.cartonNotInStock],
    ["MOVE_ACROSS_WAREHOUSES", 409, MOVE_ERROR_MESSAGES.crossWarehouse],
    ["STAGING_MOVE_NOT_ALLOWED", 409, MOVE_ERROR_MESSAGES.staging],
    ["CARTON_DOES_NOT_FIT_BIN", 422, MOVE_ERROR_MESSAGES.doesNotFit],
    ["OUT_OF_DATA_SCOPE", 403, MOVE_ERROR_MESSAGES.outOfScope],
  ])("%s", async (code, status, message) => {
    server.use(http.post(moveUrl, () => failure(status, code)));
    await openMove();
    await scanAndPick([LPN_1]);
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/English server message/)).not.toBeInTheDocument();
    // Danh sách thùng còn nguyên sau khi bị từ chối
    expect(within(cartonList()).getByText(LPN_1)).toBeInTheDocument();
  });

  it("flags the carton the BE named (details.lpn)", async () => {
    server.use(
      http.post(moveUrl, () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "STOCK_PACKAGE_HELD",
            message: "English server message",
            details: { lpn: LPN_2 },
          },
          { status: 409 },
        ),
      ),
    );
    await openMove();
    await scanAndPick([LPN_1, LPN_2]);
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(
      await screen.findByText(`${LPN_2}: ${MOVE_ERROR_MESSAGES.cartonHeld}`),
    ).toBeInTheDocument();
    const rows = within(cartonList()).getAllByRole("row");
    const flagged = rows.filter((row) => row.getAttribute("aria-invalid") === "true");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveTextContent(LPN_2);
  });
});

describe("move form — idempotency key", () => {
  it("retries the same cartons under the same requestId, a changed list under a new one", async () => {
    const ids: string[] = [];
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        ids.push(String(body.requestId));
        return failure(500, "INTERNAL_ERROR");
      }),
    );
    await openMove();
    await scanAndPick([LPN_1, LPN_2]);
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(MOVE_ERROR_MESSAGES.server);
    await userEvent.click(submit());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).toBe(ids[0]);

    await userEvent.click(screen.getByRole("button", { name: MOVE_LABELS.remove(LPN_2) }));
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await waitFor(() => expect(ids).toHaveLength(3));
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("after IDEMPOTENCY_KEY_REUSED the next send carries a fresh requestId", async () => {
    const ids: string[] = [];
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        ids.push(String(body.requestId));
        return ids.length === 1 ? failure(422, "IDEMPOTENCY_KEY_REUSED") : moved(body);
      }),
    );
    await openMove();
    await scanAndPick([LPN_1]);
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByText(MOVE_ERROR_MESSAGES.idempotencyReused)).toBeInTheDocument();
    await userEvent.click(submit());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).not.toBe(ids[0]);
  });
});

describe("move form — destination suggestions and carton finder", () => {
  it("suggests usable places of the tab warehouse, without STAGING or where the cartons are", async () => {
    server.use(
      movePermissions([stockUpdate, cartonRead, WAREHOUSE_LOCATION_PERMISSIONS.read]),
      http.get(moveEndpoint(`/warehouses/${MOVE_TAB_WAREHOUSE.id}/layout`), () =>
        HttpResponse.json({
          success: true,
          data: {
            shelves: [
              {
                levels: [
                  {
                    bins: [
                      { locationCode: "HCM-A01-1-A", usable: true },
                      { locationCode: "HCM-A01-1-B", usable: true },
                      { locationCode: "HCM-A01-1-C", usable: false },
                    ],
                  },
                ],
              },
            ],
            areas: [
              { locationCode: "HCM-PACK01", usable: true, type: "PACKING" },
              { locationCode: "HCM-STG01", usable: true, type: "STAGING" },
            ],
          },
        }),
      ),
    );
    await openMove();
    await scan(LPN_1);
    await within(cartonList()).findByText(LPN_1);
    const options = () => [
      ...document.querySelectorAll<HTMLOptionElement>("#move-toLocation-options option"),
    ];
    await waitFor(() =>
      expect(options().map((option) => option.value)).toEqual(["HCM-A01-1-B", "HCM-PACK01"]),
    );
  });

  it("finds a SKU's cartons in the tab warehouse and adds one; a held carton cannot be added", async () => {
    server.use(
      http.get(cartonsUrl, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get("sku")).toBe("SOFA-3S-GREY");
        expect(params.get("status")).toBe("IN_STOCK");
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              carton(LPN_1),
              carton(LPN_2, { reserved: 3 }),
              carton("LPN-HN-1", { locationCode: "HN-A01-1-A" }),
            ],
            hasNext: false,
          },
        });
      }),
    );
    await openMove();
    await userEvent.type(screen.getByLabelText(MOVE_LABELS.finderSearch), "sofa-3s-grey");
    const finder = screen.getByRole("region", { name: MOVE_LABELS.finderTitle });
    const add = await within(finder).findByRole("button", {
      name: `${MOVE_LABELS.finderAdd} ${LPN_1}`,
    });
    expect(within(finder).queryByText("LPN-HN-1")).not.toBeInTheDocument();
    expect(
      within(finder).getByRole("button", { name: `${MOVE_LABELS.finderAdd} ${LPN_2}` }),
    ).toBeDisabled();
    await userEvent.click(add);
    expect(within(cartonList()).getByText(LPN_1)).toBeInTheDocument();
    expect(
      within(finder).getByRole("button", { name: `${MOVE_LABELS.finderAdded} ${LPN_1}` }),
    ).toBeDisabled();
  });
});

describe("move form — destination map (docs 11 §4.1 bước 1–2)", () => {
  /** Bản đồ giả: tầng route ghép bản đồ kho thật; ở đây chỉ cần xem dữ liệu đưa vào và bấm chọn. */
  function stubMap() {
    const seen: DestinationMapProps[] = [];
    const map: DestinationMap = (props) => {
      seen.push(props);
      return (
        <section aria-label="stub-map">
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPick("HCM-PACK01")}
          >
            pick-pack
          </button>
        </section>
      );
    };
    return { map, last: () => seen.at(-1) };
  }

  it("marks where the scanned cartons are, and a pick on the map fills the destination", async () => {
    const sent = vi.fn();
    server.use(
      movePermissions([stockUpdate, cartonRead, WAREHOUSE_LOCATION_PERMISSIONS.read]),
      http.get(moveEndpoint(`/warehouses/${MOVE_TAB_WAREHOUSE.id}/layout`), () =>
        HttpResponse.json({
          success: true,
          data: {
            shelves: [{ levels: [{ bins: [{ locationCode: "HCM-A01-1-A", usable: true }] }] }],
            areas: [
              { locationCode: "HCM-PACK01", usable: true, type: "PACKING" },
              { locationCode: "HCM-STG01", usable: true, type: "STAGING" },
            ],
          },
        }),
      ),
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent(body);
        return moved(body);
      }),
    );
    const stub = stubMap();
    await openMove(stub.map);
    await scanAndPick([LPN_1, LPN_2], "");
    await waitFor(() => expect(stub.last()?.marked).toEqual(["HCM-A01-1-A", "HCM-A01-1-B"]));
    // Chỉ mã gợi ý được mới chọn được trên bản đồ: không khu tập kết, không nơi thùng đang nằm
    await waitFor(() => expect([...(stub.last()?.pickable ?? [])]).toEqual(["HCM-PACK01"]));
    expect(stub.last()?.value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: "pick-pack" }));
    expect(destination()).toHaveValue("HCM-PACK01");
    await waitFor(() => expect(stub.last()?.value).toBe("HCM-PACK01"));
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(MOVE_LABELS.resultSummary(2, "HCM-PACK01"));
    expect(sent.mock.calls[0]?.[0]).toMatchObject({ toLocation: "HCM-PACK01" });
  });

  it("scanning with the map open still reads every character of the LPN", async () => {
    const stub = stubMap();
    await openMove(stub.map);
    await scan(LPN_1);
    expect(await within(cartonList()).findByText(LPN_1)).toBeInTheDocument();
  });
});

describe("move form — bin suggestions (BE #412, docs 11 BR-10)", () => {
  const RANKED = {
    suggestions: [
      { locationCode: "HCM-A02-1-A", reason: "SAME_LOT", freeVolumeM3: 0.84, freeWeightKg: 120 },
      { locationCode: "HCM-A03-2-B", reason: "EMPTY", freeVolumeM3: null, freeWeightKg: null },
    ],
  };
  const suggestionList = () => screen.getByRole("region", { name: MOVE_LABELS.suggestionsTitle });

  it("asks once for every scanned carton and lists the ranked bins with reason and free room", async () => {
    const asked: string[][] = [];
    server.use(suggestionsReply(() => RANKED, asked));
    await openMove();
    expect(within(suggestionList()).getByText(MOVE_LABELS.suggestionsIdle)).toBeInTheDocument();
    await scanAndPick([LPN_2, LPN_1], "");
    const list = suggestionList();
    expect(await within(list).findByText("HCM-A02-1-A")).toBeInTheDocument();
    expect(within(list).getByText(PUTAWAY_DETAIL_LABELS.reason.SAME_LOT)).toBeInTheDocument();
    expect(within(list).getByText(PUTAWAY_DETAIL_LABELS.reason.EMPTY)).toBeInTheDocument();
    expect(within(list).getByText("0,84 m³")).toBeInTheDocument();
    expect(within(list).getByText("120 kg")).toBeInTheDocument();
    // Lần hỏi cuối mang cả hai thùng, sắp xếp — không hỏi khi danh sách rỗng
    expect(asked.at(-1)).toEqual([LPN_1, LPN_2]);
    expect(asked.every((lpns) => lpns.length > 0)).toBe(true);
  });

  it("choosing a suggestion fills the destination; the map gets the bins in rank order", async () => {
    const sent = vi.fn();
    const seen: DestinationMapProps[] = [];
    server.use(
      suggestionsReply(() => RANKED),
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent(body);
        return moved(body);
      }),
    );
    await openMove((props) => {
      seen.push(props);
      return null;
    });
    await scanAndPick([LPN_1], "");
    await within(suggestionList()).findByText("HCM-A02-1-A");
    await waitFor(() => expect(seen.at(-1)?.suggested).toEqual(["HCM-A02-1-A", "HCM-A03-2-B"]));
    await userEvent.click(
      screen.getByRole("button", { name: MOVE_SUGGESTION_LIST_LABELS.chooseBin("HCM-A03-2-B") }),
    );
    expect(destination()).toHaveValue("HCM-A03-2-B");
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(MOVE_LABELS.resultSummary(1, "HCM-A03-2-B"));
    expect(sent.mock.calls[0]?.[0]).toMatchObject({ toLocation: "HCM-A03-2-B" });
  });

  it("no bin takes the cartons → the OVERFLOW areas are offered", async () => {
    server.use(suggestionsReply(() => ({ suggestions: [], overflowAreas: ["HCM-OVERFLOW-1"] })));
    await openMove();
    await scanAndPick([LPN_1], "");
    expect(
      await within(suggestionList()).findByText(MOVE_LABELS.suggestionsNone),
    ).toBeInTheDocument();
    await userEvent.click(
      within(suggestionList()).getByRole("button", {
        name: MOVE_LABELS.chooseOverflow("HCM-OVERFLOW-1"),
      }),
    );
    expect(destination()).toHaveValue("HCM-OVERFLOW-1");
  });

  it("advisory only: a failed lookup says so and a typed destination still moves", async () => {
    server.use(
      http.get(suggestionsUrl, () => failure(500, "INTERNAL_ERROR")),
      http.post(moveUrl, async ({ request }) =>
        moved((await request.json()) as Record<string, unknown>),
      ),
    );
    await openMove();
    await scanAndPick([LPN_1], "HCM-PACK01");
    expect(
      await within(suggestionList()).findByText(MOVE_LABELS.suggestionsUnavailable),
    ).toBeInTheDocument();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByText(MOVE_LABELS.resultSummary(1, "HCM-PACK01"))).toBeInTheDocument();
  });

  it("suggestions hold nothing: after CARTON_DOES_NOT_FIT_BIN the bins are asked again", async () => {
    const asked: string[][] = [];
    server.use(
      suggestionsReply(() => RANKED, asked),
      http.post(moveUrl, () => failure(422, "CARTON_DOES_NOT_FIT_BIN")),
    );
    await openMove();
    await scanAndPick([LPN_1], "");
    await within(suggestionList()).findByText("HCM-A02-1-A");
    await userEvent.click(
      screen.getByRole("button", { name: MOVE_SUGGESTION_LIST_LABELS.chooseBin("HCM-A02-1-A") }),
    );
    const before = asked.length;
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByText(MOVE_ERROR_MESSAGES.doesNotFit)).toBeInTheDocument();
    await waitFor(() => expect(asked.length).toBe(before + 1));
    expect(asked.at(-1)).toEqual([LPN_1]);
  });
});
