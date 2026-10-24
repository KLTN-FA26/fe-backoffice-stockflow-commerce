/** Lỗi inline dưới ô nhập — `id` để ô nhập trỏ `aria-describedby` tới. */
export function FormFieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-danger text-xs">
      {message}
    </p>
  );
}

/** Dấu * bắt buộc — ẩn với screen reader (control đã có `aria-required`). */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-danger">
      *
    </span>
  );
}
