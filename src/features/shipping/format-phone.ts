/**
 * Số điện thoại hiển thị cho người đọc: "84911111110" / "+84911111110" → "0911 111 110" (di động 10 số: 4-3-3), "0911111110"
 * → "0911 111 110". Số không đúng dạng (cố định, quốc tế khác, có chữ) giữ nguyên — không đoán. Chỉ để hiển thị; giá trị
 * lưu và gửi BE không đổi. Đặt trong feature vì `lib/format` thuộc PR dùng chung; chuyển sang đó khi gộp.
 */
export function formatPhone(raw: string): string {
  const compact = raw.replace(/[\s.\-()]/g, "");
  const national = compact.replace(/^\+?84/, "0");
  if (!/^0\d{9}$/.test(national)) return raw;
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
}
