import { describe, expect, it } from "vitest";

import {
  DESIGN_LINE_ID,
  LOCKED_CHECKSUM,
  PLAIN_LINE_ID,
  apiEvidence,
  fulfillmentOrder,
  mismatchEvidence,
} from "./__fixtures__/task";
import {
  designLineViews,
  designedLines,
  integrityOutcome,
  isOnDesignHold,
  latestEvidenceByLine,
  shortChecksum,
  shortId,
  verificationCount,
} from "./selectors";

const OLD = "2026-10-10T03:00:00Z";
const NEW = "2026-10-10T04:00:00Z";
const OTHER_LINE = "33333333-aaaa-4bbb-8ccc-000000000003";

describe("fulfillment selectors", () => {
  it("isOnDesignHold chỉ đúng khi pack On Hold", () => {
    expect(isOnDesignHold({ packStatus: "On Hold" })).toBe(true);
    expect(isOnDesignHold({ packStatus: "Pending" })).toBe(false);
    expect(isOnDesignHold({ packStatus: "Packed" })).toBe(false);
  });

  it("latestEvidenceByLine lấy bản mới nhất của từng dòng (BE trả mới nhất trước)", () => {
    const evidence = [
      apiEvidence({ verifiedAt: NEW }),
      apiEvidence({ orderLineId: OTHER_LINE, verifiedAt: NEW, matching: false }),
      mismatchEvidence(OLD),
    ];
    const latest = latestEvidenceByLine(evidence);
    expect(latest.size).toBe(2);
    expect(latest.get(DESIGN_LINE_ID)).toMatchObject({ verifiedAt: NEW, matching: true });
    expect(latest.get(OTHER_LINE)?.matching).toBe(false);
  });

  it("integrityOutcome: chưa đối chiếu / khớp / lệch theo bản mới nhất", () => {
    expect(integrityOutcome({ integrityEvidence: [] })).toBe("unverified");
    expect(integrityOutcome({ integrityEvidence: [mismatchEvidence(OLD)] })).toBe("mismatch");
    // Kiểm tra lại đã khớp → bản lệch cũ không còn tính
    expect(
      integrityOutcome({
        integrityEvidence: [apiEvidence({ verifiedAt: NEW }), mismatchEvidence(OLD)],
      }),
    ).toBe("match");
    // Một dòng khớp, dòng khác còn lệch → lệch
    expect(
      integrityOutcome({
        integrityEvidence: [
          apiEvidence({ verifiedAt: NEW }),
          apiEvidence({ orderLineId: OTHER_LINE, verifiedAt: NEW, matching: false }),
        ],
      }),
    ).toBe("mismatch");
  });

  it("verificationCount đếm số lần đối chiếu, không phải số bản ghi", () => {
    expect(verificationCount({ integrityEvidence: [] })).toBe(0);
    expect(
      verificationCount({
        integrityEvidence: [
          apiEvidence({ verifiedAt: NEW }),
          apiEvidence({ orderLineId: OTHER_LINE, verifiedAt: NEW }),
          mismatchEvidence(OLD),
          apiEvidence({ orderLineId: OTHER_LINE, verifiedAt: OLD }),
        ],
      }),
    ).toBe(2);
  });

  it("designedLines chỉ giữ dòng có thiết kế đã khoá", () => {
    const lines = designedLines(fulfillmentOrder.lines);
    expect(lines.map((line) => line.lineId)).toEqual([DESIGN_LINE_ID]);
    expect(lines.map((line) => line.lineId)).not.toContain(PLAIN_LINE_ID);
  });

  it("designLineViews từ dòng đơn: đủ SKU / SL / checksum đã khoá + evidence mới nhất", () => {
    const views = designLineViews(
      { integrityEvidence: [mismatchEvidence(OLD)] },
      fulfillmentOrder.lines,
    );
    expect(views).toEqual([
      {
        lineId: DESIGN_LINE_ID,
        sku: "TEE-CUSTOM-L",
        quantity: 2,
        lockedChecksum: LOCKED_CHECKSUM,
        latestEvidence: expect.objectContaining({ matching: false }),
      },
    ]);
  });

  it("designLineViews khi chưa đối chiếu: dòng có thiết kế, chưa có evidence", () => {
    const [view] = designLineViews({ integrityEvidence: [] }, fulfillmentOrder.lines);
    expect(view?.latestEvidence).toBeUndefined();
  });

  it("designLineViews không đọc được đơn → suy từ evidence (không có SKU / SL)", () => {
    const views = designLineViews(
      { integrityEvidence: [apiEvidence({ verifiedAt: NEW }), mismatchEvidence(OLD)] },
      undefined,
    );
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ lineId: DESIGN_LINE_ID, lockedChecksum: LOCKED_CHECKSUM });
    expect(views[0]?.sku).toBeUndefined();
    expect(designLineViews({ integrityEvidence: [] }, undefined)).toEqual([]);
  });

  it("shortId / shortChecksum rút gọn để hiển thị", () => {
    expect(shortId("3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c")).toBe("3F4A5B6C");
    // Id BE sinh theo thời gian: hai bản ghi tạo cùng lúc trùng phần đầu, vẫn phải ra mã khác nhau
    expect(shortId("01a12aba-ed1f-70e8-99ed-eeba1d9cfe37")).not.toBe(
      shortId("01a12aba-ed22-70ba-8804-1ee722c3a3eb"),
    );
    expect(shortChecksum(LOCKED_CHECKSUM)).toBe("a".repeat(12));
  });
});
