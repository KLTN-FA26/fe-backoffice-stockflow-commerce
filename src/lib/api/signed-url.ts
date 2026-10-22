/**
 * Link tải ký ngắn hạn do BE cấp (presigned S3/MinIO). Chỉ nhận URL tuyệt đối http(s) — URL này được
 * gán vào `<a href>` / `<img src>` / `<object data>`, nên `javascript:` hay `data:` phải bị chặn.
 */
export function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
