/**
 * Nội dung hãng gửi để hiện chỉ-đọc: BE đã che thông tin xác thực, màn không dựng lại gì. JSON hợp lệ thì xuống dòng cho dễ
 * đọc; nội dung khác (tóm tắt sự kiện bị từ chối, văn bản thường) giữ nguyên.
 */
export function formatCarrierEventPayload(payload: string | null | undefined): string | null {
  if (payload == null || payload.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return typeof parsed === "object" && parsed !== null
      ? JSON.stringify(parsed, null, 2)
      : payload;
  } catch {
    return payload;
  }
}
