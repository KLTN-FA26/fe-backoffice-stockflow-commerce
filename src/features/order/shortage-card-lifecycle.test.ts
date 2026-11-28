import { describe, expect, it } from "vitest";

import { CHAT_PERMISSIONS, ORDER_PERMISSIONS, SHORTAGE_CARD_STATUSES } from "@/constants";
import { shortageCardSchema } from "@/lib/domain/shortage-card";

import { answeredCard, baseCard } from "./__fixtures__/shortage";
import { canSendShortageCard, shortageNextStep } from "./shortage-card-lifecycle";

import type { PermissionCode } from "@/lib/auth";

const sales = new Set<PermissionCode>([
  ORDER_PERMISSIONS.read,
  ORDER_PERMISSIONS.hold,
  ORDER_PERMISSIONS.partialShipment,
  ORDER_PERMISSIONS.cancel,
  CHAT_PERMISSIONS.update,
]);
const can = (code: PermissionCode) => sales.has(code);
const parse = (card: unknown) => shortageCardSchema.parse(card);

describe("shortageNextStep — mỗi trạng thái thẻ → việc của Sale (docs 17 §4.14, §5.6)", () => {
  it("SENT → chờ khách", () => {
    expect(shortageNextStep(parse(baseCard), "On Hold", can)).toEqual({ kind: "wait-customer" });
  });
  it.each(["WAIT_FOR_PRODUCTION", "REDUCE_CARTONS", "SHIP_PART_CLOSE_REST", "CANCEL_ORDER"])(
    "ANSWERED + %s → Thực hiện đúng hướng khách chọn",
    (option) => {
      expect(shortageNextStep(parse(answeredCard(option)), "On Hold", can)).toEqual({
        kind: "execute",
        option,
        allowed: true,
      });
    },
  );
  it.each(["EXECUTED", "SUPERSEDED", "EXPIRED"] as const)(
    "%s là trạng thái cuối — không việc nào",
    (status) => {
      expect(
        shortageNextStep(parse(answeredCard("CANCEL_ORDER", { status })), "On Hold", can),
      ).toEqual({
        kind: "none",
      });
    },
  );
  it("giao một phần: bước 1 xong, kho chưa kiểm xong → chờ; đơn Partially Fulfilled → Đóng phần còn lại", () => {
    const card = parse(answeredCard("SHIP_PART_CLOSE_REST", { executionStarted: true }));
    expect(shortageNextStep(card, "Picking", can)).toEqual({ kind: "await-partial-check" });
    expect(shortageNextStep(card, "Partially Fulfilled", can)).toEqual({
      kind: "close-rest",
      allowed: true,
    });
  });
  it("thiếu quyền của thao tác → vẫn hiện việc nhưng allowed=false (nút khoá kèm lý do)", () => {
    const noCancel = (code: PermissionCode) => code !== ORDER_PERMISSIONS.cancel && can(code);
    expect(shortageNextStep(parse(answeredCard("CANCEL_ORDER")), "On Hold", noCancel)).toEqual({
      kind: "execute",
      option: "CANCEL_ORDER",
      allowed: false,
    });
  });
  it("phủ đủ mọi trạng thái BE", () => {
    expect(SHORTAGE_CARD_STATUSES).toHaveLength(5);
  });
});

describe("canSendShortageCard", () => {
  it("cần chat-conversations:UPDATE và sales-orders:READ", () => {
    expect(canSendShortageCard(can)).toBe(true);
    expect(canSendShortageCard((c) => c !== CHAT_PERMISSIONS.update && can(c))).toBe(false);
  });
});
