/**
 * Thân dialog cuộn được khi nội dung dài (form nhiều ô, danh sách giá trị, bảng xem trước) — đặt
 * trong `FormDialogBody` để header, mô tả và nút xác nhận luôn nằm trong màn hình thấp.
 * `FormDialogBody` không tự cuộn nên dialog ngắn của module khác không bị ảnh hưởng.
 */
export function DialogScrollArea({ children }: { children: React.ReactNode }) {
  return <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">{children}</div>;
}
