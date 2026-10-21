"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";

import { PACKAGE_TYPES, UI_LABELS } from "@/constants";
import { isRetryablePackingError } from "@/features/fulfillment/packing-errors";
import { useOpenPackage } from "@/features/fulfillment/packing-mutations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PackageType } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing;

/**
 * Mở kiện rỗng mới (loại kiện mặc định CARTON). Mỗi lần gọi BE mở thêm một kiện, nên request mang
 * `Idempotency-Key`: bấm lại sau lỗi mạng / 5xx gửi CÙNG key (không mở hai kiện); thành công hoặc
 * lỗi nghiệp vụ 4xx thì đổi key.
 */
export function OpenPackageButton({ taskId }: { taskId: string }) {
  const open = useOpenPackage();
  const [type, setType] = useState<PackageType>("CARTON");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const submit = () =>
    open.mutate(
      { taskId, packageType: type, idempotencyKey },
      {
        onSuccess: () => setIdempotencyKey(crypto.randomUUID()),
        onError: (error) => {
          if (!isRetryablePackingError(error)) setIdempotencyKey(crypto.randomUUID());
        },
      },
    );

  return (
    <div className="flex items-center gap-2">
      <Select
        value={type}
        onValueChange={(value) => setType(PACKAGE_TYPES.find((t) => t === value) ?? "CARTON")}
      >
        <SelectTrigger
          aria-label={L.packages.typeLabel}
          className="border-border-default bg-bg-surface h-8 w-[9.5rem] rounded-[var(--r-sm)] text-[0.8125rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PACKAGE_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {L.packages.typeOption[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={open.isPending}
        onClick={submit}
        className="rounded-[var(--r-sm)]"
      >
        <PackagePlus className="size-3.5" /> {L.action.openPackage}
      </Button>
    </div>
  );
}
