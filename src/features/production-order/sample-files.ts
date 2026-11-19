/**
 * Kiểm tệp ảnh / video mẫu in phía trình duyệt trước khi xin slot (BE `ProductionSampleService#beginUpload`: ảnh, MP4,
 * QuickTime, WebM; ≤ 100 MB; ≤ 10 tệp mỗi lần — `SampleRounds.MEDIA_PER_UPLOAD_MAX`). BE kiểm lại khi gắn tệp.
 */

import { PRODUCTION_LABELS, PRODUCTION_LIMITS, SAMPLE_MEDIA_ACCEPT } from "@/constants";

const S = PRODUCTION_LABELS.sample;
/** Cùng một danh sách với ô chọn tệp (`accept`) — sửa một chỗ trong constants. */
const VIDEO_TYPES = SAMPLE_MEDIA_ACCEPT.split(",").filter((type) => type.startsWith("video/"));

export const isSampleMediaType = (type: string): boolean =>
  type.startsWith("image/") || VIDEO_TYPES.includes(type);

/** Lỗi của bộ tệp đã chọn, theo thứ tự gặp; rỗng = gửi được. */
export function sampleFileProblems(files: readonly File[]): string[] {
  const problems: string[] = [];
  if (files.length > PRODUCTION_LIMITS.mediaPerUploadMax) problems.push(S.tooMany);
  for (const file of files) {
    if (!isSampleMediaType(file.type)) problems.push(S.badType(file.name));
    else if (file.size > PRODUCTION_LIMITS.mediaMaxBytes) problems.push(S.tooLarge(file.name));
  }
  return problems;
}
