"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { Button } from "@/components/ui/button";

import { attributeErrorMessage } from "../attribute-errors";
import { ActiveDot } from "../active-status";
import { DATA_TYPE_LABEL } from "../attribute-labels";
import { useDeleteAttribute, useDeleteAttributeValue } from "../attribute-queries";
import { holdsValues } from "../attribute-schemas";
import { AttributeFormDialog } from "./AttributeFormDialog";
import { AttributeValueFormDialog } from "./AttributeValueFormDialog";
import { AttributeValuesTable } from "./AttributeValuesTable";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";

import type { Attribute, AttributeValue } from "../attribute-schemas";

/**
 * Chi tiết một thuộc tính: thông tin, danh sách giá trị (thêm / sửa / xoá) và xoá thuộc tính. Giá trị
 * là một phần của thuộc tính nên cùng quyền UPDATE; xoá thuộc tính cần quyền DELETE. Thuộc tính / giá
 * trị còn được sản phẩm hoặc danh mục dùng thì BE từ chối xoá (409 ATTRIBUTE_IN_USE) — vô hiệu hoá
 * thay vì xoá. Backend phải re-check.
 */
export function AttributeDetailPanel({
  attribute,
  onClose,
}: {
  attribute: Attribute | null;
  onClose: () => void;
}) {
  const can = usePermissionChecker();
  const [editing, setEditing] = useState(false);
  const [valueForm, setValueForm] = useState<{ value?: AttributeValue } | null>(null);
  const [deleting, setDeleting] = useState<"attribute" | AttributeValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const removeAttribute = useDeleteAttribute();
  const removeValue = useDeleteAttributeValue();
  const canUpdate = can(ATTRIBUTE_PERMISSIONS.update);
  const canDelete = can(ATTRIBUTE_PERMISSIONS.delete);

  const close = () => {
    setDeleting(null);
    setError(null);
  };
  const confirm = () => {
    if (!attribute || !deleting) return;
    setError(null);
    const onError = (e: unknown) => setError(attributeErrorMessage(e, "delete"));
    if (deleting === "attribute") {
      removeAttribute.mutate(
        { attributeId: attribute.attributeId, version: attribute.version },
        {
          onSuccess: () => {
            close();
            onClose();
          },
          onError,
        },
      );
    } else {
      removeValue.mutate(
        {
          attributeId: attribute.attributeId,
          valueId: deleting.valueId,
          version: deleting.version,
        },
        { onSuccess: close, onError },
      );
    }
  };

  return (
    <SlideOverPanel
      open={attribute !== null}
      onClose={onClose}
      title={attribute?.code ?? ""}
      monoTitle
      subtitle={attribute?.name}
      badge={attribute && <ActiveDot active={attribute.active} />}
    >
      {attribute && (
        <div className="space-y-4">
          <DetailPanel
            title="Thông tin"
            actions={
              (canUpdate || canDelete) && (
                <>
                  {canUpdate && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="size-3.5" aria-hidden /> Sửa
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-danger text-danger hover:bg-danger/10"
                      onClick={() => setDeleting("attribute")}
                    >
                      <Trash2 className="size-3.5" aria-hidden /> Xoá
                    </Button>
                  )}
                </>
              )
            }
          >
            <FactGrid columns={2}>
              <Fact label="Loại">{DATA_TYPE_LABEL[attribute.dataType]}</Fact>
              <Fact label="Đơn vị">{attribute.unit || "—"}</Fact>
              <Fact label="Lọc / tìm kiếm">
                {[attribute.filterable && "Lọc", attribute.searchable && "Tìm kiếm"]
                  .filter(Boolean)
                  .join(", ") || "Không"}
              </Fact>
              <Fact label="Thứ tự">
                <span className="tabular-nums">{attribute.sortOrder}</span>
              </Fact>
            </FactGrid>
          </DetailPanel>

          {holdsValues(attribute.dataType) ? (
            <DetailPanel
              title="Giá trị"
              count={attribute.values.length}
              flush
              actions={
                canUpdate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValueForm({})}
                  >
                    <Plus className="size-3.5" aria-hidden /> Thêm giá trị
                  </Button>
                )
              }
            >
              <AttributeValuesTable
                values={attribute.values}
                canUpdate={canUpdate}
                onEdit={(value) => setValueForm({ value })}
                onDelete={setDeleting}
              />
            </DetailPanel>
          ) : (
            <p className="text-ink-tertiary text-[0.8125rem]">
              Thuộc tính loại {DATA_TYPE_LABEL[attribute.dataType].toLowerCase()} nhập giá trị trực
              tiếp trên sản phẩm, không có danh sách giá trị.
            </p>
          )}
        </div>
      )}

      {attribute && (
        <>
          <AttributeFormDialog attribute={attribute} open={editing} onOpenChange={setEditing} />
          <AttributeValueFormDialog
            attribute={attribute}
            value={valueForm?.value}
            open={valueForm !== null}
            onOpenChange={(open) => !open && setValueForm(null)}
          />
        </>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && close()}
        title={deleting === "attribute" ? "Xoá thuộc tính?" : "Xoá giá trị?"}
        description={
          deleting === "attribute"
            ? `${attribute?.code ?? ""} và mọi giá trị của nó sẽ bị xoá vĩnh viễn. Thuộc tính đang được sản phẩm hoặc danh mục dùng thì không xoá được — hãy vô hiệu hoá.`
            : `Giá trị ${deleting ? deleting.code : ""} sẽ bị xoá vĩnh viễn. Giá trị đang được sản phẩm dùng thì không xoá được — hãy vô hiệu hoá.`
        }
        confirmLabel="Xoá"
        closeOnConfirm={false}
        loading={removeAttribute.isPending || removeValue.isPending}
        error={error}
        onConfirm={confirm}
      />
    </SlideOverPanel>
  );
}
