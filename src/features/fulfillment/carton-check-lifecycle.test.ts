import { describe, expect, it } from "vitest";

import { CARTON_STATUSES } from "@/constants";
import { CARTON_TRANSITIONS } from "@/lib/domain/lifecycle";

import { IDENTITIES, type TestIdentity } from "./__fixtures__/render";
import {
  OTHER_STARTER_ID,
  STARTER_ID,
  allLabeledSession,
  apiCarton,
  apiSession,
  checkedCarton,
  labeledCarton,
  startedSession,
} from "./__fixtures__/carton-check";
import { toCartonCheckSession } from "./carton-check-api";
import {
  cartonActions,
  cartonCheckAccess,
  labelableCartons,
  printableCartons,
} from "./carton-check-lifecycle";

import type { CartonCheckSessionDto } from "./carton-check-types";
import type { FulfillmentActor } from "./lifecycle";

function actorOf(identity: TestIdentity, userId: string | null = STARTER_ID): FulfillmentActor {
  return { can: (code) => identity.permissions.includes(code), userId };
}

const session = (dto: CartonCheckSessionDto) => toCartonCheckSession(dto);

describe("CARTON_TRANSITIONS (docs 08 §5.2; BE PackageStatus của 4C-6)", () => {
  it("mọi trạng thái thùng đều có trong bảng", () => {
    expect(Object.keys(CARTON_TRANSITIONS).sort()).toEqual([...CARTON_STATUSES].sort());
  });

  it("To Check → Checked / Removed; Checked → Labeled / Removed", () => {
    expect(CARTON_TRANSITIONS["To Check"]).toEqual(["Checked", "Removed"]);
    expect(CARTON_TRANSITIONS.Checked).toEqual(["Labeled", "Removed"]);
  });

  it("Labeled chỉ → Removed (thùng hư hỏng, khi chưa thuộc shipment); Removed là terminal", () => {
    expect(CARTON_TRANSITIONS.Labeled).toEqual(["Removed"]);
    expect(CARTON_TRANSITIONS.Removed).toEqual([]);
  });

  it("không có đường tắt: To Check không nhảy thẳng sang Labeled", () => {
    expect(CARTON_TRANSITIONS["To Check"]).not.toContain("Labeled");
  });
});

describe("cartonCheckAccess — BR-06: chỉ người bắt đầu phiên hoặc quản lý kho thao tác", () => {
  it("phiên Pending + NV kho (packing:UPDATE): bắt đầu được, chưa quét / hoàn tất được", () => {
    const access = cartonCheckAccess(session(apiSession()), actorOf(IDENTITIES.warehouseStaff));
    expect(access).toMatchObject({ canStart: true, canWork: false, canReprint: false });
  });

  it("phiên In Progress do chính mình bắt đầu: làm việc được, không phải 'bị chiếm'", () => {
    const access = cartonCheckAccess(session(startedSession()), actorOf(IDENTITIES.warehouseStaff));
    expect(access).toMatchObject({
      isOwner: true,
      canStart: false,
      canWork: true,
      canReprint: true,
      takenByOther: false,
      managerAssist: false,
    });
  });

  it("phiên do người khác bắt đầu: NV kho chỉ xem (takenByOther), không quét, không in lại", () => {
    const access = cartonCheckAccess(
      session(startedSession()),
      actorOf(IDENTITIES.warehouseStaff, OTHER_STARTER_ID),
    );
    expect(access).toMatchObject({
      canWork: false,
      canReprint: false,
      takenByOther: true,
      canRead: true,
    });
  });

  it("phiên do người khác bắt đầu: quản lý kho (packing:APPROVE) làm thay được", () => {
    const access = cartonCheckAccess(
      session(startedSession()),
      actorOf(IDENTITIES.warehouseManager, OTHER_STARTER_ID),
    );
    expect(access).toMatchObject({
      canWork: true,
      canReprint: true,
      takenByOther: false,
      managerAssist: true,
    });
  });

  it("phiên Completed: không còn thao tác kiểm, nhưng người bắt đầu / quản lý kho vẫn in lại nhãn được", () => {
    const done = session(startedSession({ status: "COMPLETED" }));
    expect(cartonCheckAccess(done, actorOf(IDENTITIES.warehouseStaff))).toMatchObject({
      canWork: false,
      canReprint: true,
    });
    expect(
      cartonCheckAccess(done, actorOf(IDENTITIES.warehouseStaff, OTHER_STARTER_ID)).canReprint,
    ).toBe(false);
    expect(
      cartonCheckAccess(done, actorOf(IDENTITIES.warehouseManager, OTHER_STARTER_ID)).canReprint,
    ).toBe(true);
  });

  it("phiên Cancelled: không thao tác nào", () => {
    const cancelled = session(startedSession({ status: "CANCELLED" }));
    expect(cartonCheckAccess(cancelled, actorOf(IDENTITIES.warehouseManager))).toMatchObject({
      canStart: false,
      canWork: false,
      canReprint: false,
    });
  });

  it("điều phối đơn (không có quyền kiểm thùng) và QC chỉ xem; không bắt đầu được", () => {
    for (const identity of [IDENTITIES.orderCoordinator, IDENTITIES.qcStaff]) {
      const access = cartonCheckAccess(session(apiSession()), actorOf(identity));
      expect(access).toMatchObject({ canPack: false, canStart: false, canWork: false });
    }
  });

  it("chưa đăng nhập (userId null) không bao giờ là người bắt đầu", () => {
    const access = cartonCheckAccess(
      session(startedSession()),
      actorOf(IDENTITIES.warehouseStaff, null),
    );
    expect(access.isOwner).toBe(false);
    expect(access.canWork).toBe(false);
  });

  it("in PDF nhãn cần fulfillment-packing:READ", () => {
    expect(
      cartonCheckAccess(session(apiSession()), actorOf(IDENTITIES.warehouseStaff)).canPrint,
    ).toBe(true);
    expect(cartonCheckAccess(session(apiSession()), actorOf(IDENTITIES.qcStaff)).canPrint).toBe(
      false,
    );
  });
});

describe("cartonActions — action-gating theo trạng thái thùng + quyền", () => {
  const owner = cartonCheckAccess(session(startedSession()), actorOf(IDENTITIES.warehouseStaff));
  const viewer = cartonCheckAccess(
    session(startedSession()),
    actorOf(IDENTITIES.warehouseStaff, OTHER_STARTER_ID),
  );
  const view = session(
    startedSession({
      shipments: [
        {
          shipmentId: "s-1",
          code: "SO-1-S1",
          status: "READY_TO_DISPATCH",
          packageCount: 1,
          partial: true,
        },
        {
          shipmentId: "s-2",
          code: "SO-1-S2",
          status: "HANDED_OVER",
          packageCount: 1,
          partial: false,
        },
      ],
    }),
  );
  const carton = (dto: ReturnType<typeof apiCarton>) => {
    const [first] = toCartonCheckSession(startedSession({ cartons: [dto] })).cartons;
    if (!first) throw new Error("thùng không parse được");
    return first;
  };

  it("To Check: chỉ loại thùng được; chưa dán / in / in lại", () => {
    expect(cartonActions(carton(apiCarton()), view, owner)).toEqual({
      label: false,
      print: false,
      reprint: false,
      remove: true,
    });
  });

  it("Checked: dán nhãn + loại thùng", () => {
    expect(cartonActions(carton(checkedCarton()), view, owner)).toMatchObject({
      label: true,
      print: false,
      remove: true,
    });
  });

  it("Checked của SKU thiếu quy cách thùng (BR-07): không dán nhãn được, vẫn loại được", () => {
    const unmeasured = { ...view, skusWithoutCartonSpec: ["TEE-BLK-M"] };
    expect(cartonActions(carton(checkedCarton()), unmeasured, owner)).toMatchObject({
      label: false,
      remove: true,
    });
  });

  it("Labeled chưa vào shipment: in nhãn, in lại, loại thùng; không dán nhãn lại", () => {
    expect(cartonActions(carton(labeledCarton()), view, owner)).toEqual({
      label: false,
      print: true,
      reprint: true,
      remove: true,
    });
  });

  it("Labeled đã vào shipment: không loại khỏi đơn (409 PACKAGE_SHIPPED); in lại chỉ khi shipment còn ở kho", () => {
    expect(cartonActions(carton(labeledCarton({ shipmentId: "s-1" })), view, owner)).toEqual({
      label: false,
      print: true,
      reprint: true,
      remove: false,
    });
    expect(cartonActions(carton(labeledCarton({ shipmentId: "s-2" })), view, owner)).toMatchObject({
      reprint: false,
      remove: false,
    });
  });

  it("Removed là terminal: không thao tác nào", () => {
    expect(
      cartonActions(
        carton(apiCarton({ status: "REMOVED", removalReason: "DAMAGED" })),
        view,
        owner,
      ),
    ).toEqual({ label: false, print: false, reprint: false, remove: false });
  });

  it("người không phải người bắt đầu (và không phải quản lý kho): không dán nhãn / loại / in lại, vẫn in PDF nếu có packing:READ", () => {
    expect(cartonActions(carton(checkedCarton()), view, viewer)).toMatchObject({
      label: false,
      remove: false,
    });
    expect(cartonActions(carton(labeledCarton()), view, viewer)).toEqual({
      label: false,
      print: true,
      reprint: false,
      remove: false,
    });
  });

  it("trạng thái lạ của BE → 'Unknown': không mở thao tác nào", () => {
    const unknown = carton(apiCarton({ status: "UNKNOWN" as never }));
    expect(unknown.status).toBe("Unknown");
    expect(cartonActions(unknown, view, owner)).toEqual({
      label: false,
      print: false,
      reprint: false,
      remove: false,
    });
  });
});

describe("labelableCartons / printableCartons", () => {
  it("dán nhãn loạt: chỉ thùng Checked của SKU đã có quy cách; in loạt: thùng Labeled chưa vào shipment", () => {
    const mixed = session(
      startedSession({
        skusWithoutCartonSpec: ["MUG-WHT-11"],
        cartons: [
          checkedCarton(),
          checkedCarton({ packageNo: 2, lpn: "LPN000002", sku: "MUG-WHT-11" }),
          apiCarton({ packageNo: 3, lpn: "LPN000003" }),
          labeledCarton({ packageNo: 4, lpn: "LPN000004" }),
          labeledCarton({ packageNo: 5, lpn: "LPN000005", shipmentId: "s-1" }),
        ],
      }),
    );
    expect(labelableCartons(mixed).map((c) => c.lpn)).toEqual(["LPN000001"]);
    expect(printableCartons(mixed).map((c) => c.lpn)).toEqual(["LPN000004"]);
  });

  it("phiên đã dán nhãn hết: không còn gì để dán", () => {
    expect(labelableCartons(session(allLabeledSession()))).toEqual([]);
  });
});
