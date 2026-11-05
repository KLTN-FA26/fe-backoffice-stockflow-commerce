/**
 * `scanId` của các lần quét chưa có câu trả lời dứt khoát (mất mạng, 5xx, phản hồi sai — yêu cầu có thể
 * ĐÃ tới BE): quét lại cùng mã dùng lại đúng id để BE không ghi hai lần. Sống ngoài màn quét vì gỡ kiện
 * (ở bảng lô) cũng phải quên id: BE trả lại câu trả lời cũ cho `scanId` đã ghi mà KHÔNG xếp kiện lên xe
 * lần nữa, nên sau khi gỡ kiện, quét lại bằng id cũ sẽ báo thành công giả.
 */

const pending = new Map<string, string>();
const key = (loadId: string, packageCode: string) => `${loadId}:${packageCode.toUpperCase()}`;

/** `scanId` cho lần quét `packageCode`: id đang chờ nếu có, không thì id mới (và nhớ lại). */
export function scanIdFor(loadId: string, packageCode: string): string {
  const existing = pending.get(key(loadId, packageCode));
  if (existing) return existing;
  const id = crypto.randomUUID();
  pending.set(key(loadId, packageCode), id);
  return id;
}

/** Quên id của mã — gọi khi có câu trả lời dứt khoát hoặc khi kiện vừa được gỡ khỏi xe. */
export function forgetScanId(loadId: string, packageCode: string): void {
  pending.delete(key(loadId, packageCode));
}

export function resetScanIds(): void {
  pending.clear();
}
