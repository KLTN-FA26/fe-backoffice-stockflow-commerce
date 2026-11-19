/** Fixture theo hợp đồng BE `SampleRounds` / `SampleRound` (`ProductionSampleRoundController`). */

import { COORDINATOR_ID, productionOrder } from "./production-order";

import type { SampleRound, SampleRounds } from "../sample-schemas";

export function sampleRound(overrides: Partial<SampleRound> = {}): SampleRound {
  return {
    id: "round-1",
    roundNo: 1,
    counted: true,
    openedBy: COORDINATOR_ID,
    openedAt: "2026-11-18T03:00:00Z",
    media: [
      {
        id: "media-1",
        fileName: "mau-vong-1.jpg",
        contentType: "image/jpeg",
        sizeBytes: 204800,
        video: false,
        uploadedAt: "2026-11-18T03:00:00Z",
      },
    ],
    ...overrides,
  };
}

export function sampleRounds(overrides: Partial<SampleRounds> = {}): SampleRounds {
  return {
    productionOrderId: productionOrder().id,
    code: productionOrder().code,
    status: "SAMPLE_PENDING",
    sampleApprovalRequired: true,
    version: 5,
    freeSampleRounds: 2,
    countedRounds: 1,
    freeRoundsExceeded: false,
    waitingRoundId: "round-1",
    rounds: [sampleRound()],
    ...overrides,
  };
}
