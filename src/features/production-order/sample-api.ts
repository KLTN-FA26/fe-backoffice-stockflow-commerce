/**
 * Vòng mẫu in (kltn-docs 17 §4.3 bước 9) — BE `ProductionSampleRoundController`, base `/production-orders/{id}/sample-rounds`:
 *
 *   GET  …                          → SampleRounds                     (production-orders:READ)
 *   POST …/uploads {fileName, contentType, sizeBytes, sha256} → UploadSlot (:UPDATE; ảnh / MP4 / QuickTime / WebM ≤ 100 MB)
 *   POST … {uploadIds, physicalSampleSentOn?, reprintReason?} → mở vòng (vòng 1: ACCEPTED → SAMPLE_PENDING)
 *   POST …/{roundId}/media {uploadIds}                    → thêm tệp cho vòng đang chờ khách
 *   PUT  …/{roundId}/physical-sample {sentOn}             → ghi ngày gửi mẫu vật
 *   GET  …/{roundId}/media/{mediaId}/view-url             → link xem vài phút (không log, không lưu)
 */

import { api } from "@/lib/api/client";
import { uploadFileDirect } from "@/lib/api/direct-upload";

import { sampleMediaLinkDto, sampleRoundsDto } from "./sample-schemas";

import type { DirectUploadProgress, UploadDeclaration } from "@/lib/api/direct-upload";
import type { ReprintReason } from "@/constants";
import type { SampleRounds } from "./sample-schemas";

const roundsPath = (orderId: string, tail = "") =>
  `/production-orders/${encodeURIComponent(orderId)}/sample-rounds${tail}`;

export async function getSampleRounds(
  orderId: string,
  signal?: AbortSignal,
): Promise<SampleRounds> {
  const { data } = await api.get<unknown>(roundsPath(orderId), { signal });
  return sampleRoundsDto.parse(data);
}

/** Bước 1–2 của tải tệp thẳng lên kho lưu trữ (`lib/api/direct-upload`); trả `uploadId` để gắn vào vòng. */
export function uploadSampleMedia(
  orderId: string,
  file: File,
  onProgress?: (progress: DirectUploadProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  return uploadFileDirect({
    file,
    signal,
    onProgress,
    declare: async (declaration: UploadDeclaration, declareSignal?: AbortSignal) => {
      const { data } = await api.post<unknown>(roundsPath(orderId, "/uploads"), declaration, {
        signal: declareSignal,
      });
      return data;
    },
  });
}

export interface OpenRoundInput {
  orderId: string;
  uploadIds: string[];
  physicalSampleSentOn: string | null;
  reprintReason: ReprintReason | null;
}

export async function openSampleRound(input: OpenRoundInput): Promise<SampleRounds> {
  const { data } = await api.post<unknown>(roundsPath(input.orderId), {
    uploadIds: input.uploadIds,
    physicalSampleSentOn: input.physicalSampleSentOn ?? undefined,
    reprintReason: input.reprintReason ?? undefined,
  });
  return sampleRoundsDto.parse(data);
}

export interface RoundMediaInput {
  orderId: string;
  roundId: string;
  uploadIds: string[];
}

export async function addSampleMedia(input: RoundMediaInput): Promise<SampleRounds> {
  const { data } = await api.post<unknown>(
    roundsPath(input.orderId, `/${encodeURIComponent(input.roundId)}/media`),
    { uploadIds: input.uploadIds },
  );
  return sampleRoundsDto.parse(data);
}

export interface PhysicalSampleInput {
  orderId: string;
  roundId: string;
  sentOn: string;
}

export async function recordPhysicalSample(input: PhysicalSampleInput): Promise<SampleRounds> {
  const { data } = await api.put<unknown>(
    roundsPath(input.orderId, `/${encodeURIComponent(input.roundId)}/physical-sample`),
    { sentOn: input.sentOn },
  );
  return sampleRoundsDto.parse(data);
}

export async function getSampleMediaLink(
  orderId: string,
  roundId: string,
  mediaId: string,
): Promise<string> {
  const { data } = await api.get<unknown>(
    roundsPath(
      orderId,
      `/${encodeURIComponent(roundId)}/media/${encodeURIComponent(mediaId)}/view-url`,
    ),
  );
  return sampleMediaLinkDto.parse(data).url;
}
