"use client";

import { useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { HeaderCreateButton } from "@/components/shared/HeaderActions";
import { Select, SelectItem, SelectValue } from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { DATA_TYPE_LABEL, ROLE_LABEL } from "../attribute-labels";
import { canBeVariantAxis } from "../attribute-schemas";
import { ProductSelectTrigger } from "./form-controls";

import type { Attribute } from "../attribute-schemas";

/**
 * Nút "Thêm thuộc tính" (trên thanh breadcrumb) của bộ thuộc tính danh mục: mở popup chọn một thuộc
 * tính — ô chọn hiện thuộc tính đã chọn ngay trong popup. "Lưu" gọi API lưu bộ (bộ hiện tại + thuộc
 * tính mới); danh sách bên dưới lấy lại từ server, không chèn dòng tạm ở FE. Lưu xong thì đóng popup.
 */
export function CategoryAttributeAddDialog({
  addable,
  onSave,
  saving,
  error,
}: {
  addable: readonly Attribute[];
  /** Lưu bộ kèm thuộc tính mới; gọi `done` khi lưu thành công để đóng popup. */
  onSave: (attribute: Attribute, done: () => void) => void;
  saving: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const picked = addable.find((a) => a.attributeId === pickedId);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPickedId("");
      }}
    >
      <DialogTrigger asChild>
        <HeaderCreateButton
          aria-label="Tạo mới thuộc tính cho danh mục"
          tooltip="Thêm thuộc tính vào bộ của danh mục"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm thuộc tính cho danh mục</DialogTitle>
          <DialogDescription>
            Chọn một thuộc tính rồi lưu để thêm vào bộ gợi ý của danh mục.
          </DialogDescription>
        </DialogHeader>
        {addable.length > 0 ? (
          <div className="space-y-1.5">
            <Select value={pickedId} onValueChange={setPickedId} disabled={saving}>
              <ProductSelectTrigger
                aria-label="Thuộc tính cần thêm"
                className="w-full *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-left"
              >
                <SelectValue placeholder="Chọn thuộc tính" />
              </ProductSelectTrigger>
              <TitledSelectContent title="Thêm thuộc tính">
                {addable.map((a) => (
                  <SelectItem key={a.attributeId} value={a.attributeId}>
                    {a.name} ({a.code})
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
            {picked && (
              <p className="text-ink-tertiary text-xs">
                {DATA_TYPE_LABEL[picked.dataType]} · vai trò mặc định{" "}
                {ROLE_LABEL[canBeVariantAxis(picked.dataType) ? "VARIANT_AXIS" : "DESCRIPTIVE"]}
              </p>
            )}
          </div>
        ) : (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Mọi thuộc tính đang dùng đã có trong bộ này.
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter>
          <Button
            type="button"
            disabled={!picked || saving}
            onClick={() => {
              if (picked)
                onSave(picked, () => {
                  setOpen(false);
                  setPickedId("");
                });
            }}
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
