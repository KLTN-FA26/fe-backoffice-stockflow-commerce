import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues } from "@/features/shipping/types";

/**
 * Hộp kiểm "Người ký là tài xế" của hộp thoại bàn giao (owner 26/11, UX-Q6; docs 09 §4.2 bước 8 và BR-18, PR docs #55):
 * hệ thống KHÔNG tự điền người ký bên hãng từ tên tài xế — chỉ khi nhân viên tick thì tên tài xế được sao chép sang ô
 * người ký, và ô đó vẫn sửa được. Khi còn tick mà tên tài xế đổi (đang nhập ở ô tên tài xế của hộp thoại), ô người ký
 * theo cho tới khi nhân viên tự sửa nó. Bỏ tick thì xoá phần đã sao chép (không đụng chữ nhân viên đã sửa).
 */
export function useSignerIsDriver(
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>,
  /** Tên tài xế đã có trên chuyến (từ đặt xe / webhook); rỗng thì lấy ô "Tên tài xế" của hộp thoại. */
  loadDriverName: string | null | undefined,
) {
  const [checked, setChecked] = useState(false);
  const typed = useWatch({ control: form.control, name: "driverName" });
  const driverName = (loadDriverName ?? typed ?? "").trim();
  // Tên đã sao chép lần cuối: để biết ô người ký còn nguyên bản sao hay nhân viên đã sửa
  const copied = useRef("");

  const copy = (name: string) => {
    form.setValue("carrierRepresentative", name, { shouldValidate: true, shouldDirty: true });
    copied.current = name;
  };

  useEffect(() => {
    if (!checked) return;
    const current = form.getValues("carrierRepresentative");
    if (current && current !== copied.current) return; // nhân viên đã tự sửa: không đè
    if (driverName !== copied.current) {
      form.setValue("carrierRepresentative", driverName, {
        shouldValidate: true,
        shouldDirty: true,
      });
      copied.current = driverName;
    }
  }, [checked, driverName, form]);

  return {
    checked,
    onChange: (next: boolean) => {
      setChecked(next);
      if (next) {
        copy(driverName);
        return;
      }
      if (form.getValues("carrierRepresentative") === copied.current)
        form.setValue("carrierRepresentative", "", { shouldValidate: true, shouldDirty: true });
      copied.current = "";
    },
  };
}
