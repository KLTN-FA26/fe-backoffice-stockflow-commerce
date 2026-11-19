/**
 * Mở một file PDF (Blob) ở tab mới; trình duyệt chặn popup thì tải xuống bằng thẻ `<a download>`.
 * URL tạm được thu hồi sau một phút để tab mới kịp đọc.
 */
export function openBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Mở đường dẫn tải có hạn (BE `DownloadLink {url, expiresAt}`) ở tab mới. */
export function openLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
