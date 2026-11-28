import { useEffect, useEffectEvent } from "react";

/**
 * Chỉ có đúng một lựa chọn thì chọn sẵn cho người dùng (UX audit S21-2): kho nhận, khu cách ly. Chạy lại khi lựa chọn
 * hiện tại bị xoá (đổi kho → khu cách ly về rỗng → chọn lại khu duy nhất của kho mới). Đã có giá trị thì không đè.
 */
export function useSingleChoiceDefault(
  only: string | undefined,
  current: string,
  apply: (value: string) => void,
) {
  const choose = useEffectEvent(apply);
  useEffect(() => {
    if (only && !current) choose(only);
  }, [only, current]);
}
