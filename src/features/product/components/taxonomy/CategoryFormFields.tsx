"use client";

import { useWatch } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { parentCodeOf } from "../../taxonomy-schemas";
import { Field } from "../variants/Field";
import { CategoryParentSelect } from "./CategoryParentSelect";
import { TAXONOMY_INPUT_CLASS, TAXONOMY_TEXTAREA_CLASS } from "./form-classes";
import { CheckboxField, DialogScrollArea } from "./form-parts";
import { UrlPreviewThumb } from "./TaxonomyThumb";

import type { UseFormReturn } from "react-hook-form";
import type { CategoryFormValues } from "../../taxonomy-input-schemas";
import type { CategoryNode } from "../../taxonomy-schemas";

const L = UI_LABELS.taxonomy;
const F = L.field;
const MONO = "font-[family-name:var(--font-mono)] uppercase";

export function CategoryFormFields({
  form,
  category,
  readOnly,
}: {
  form: UseFormReturn<CategoryFormValues>;
  category?: CategoryNode;
  readOnly: boolean;
}) {
  const editing = Boolean(category);
  const errors = form.formState.errors;
  const [imageUrl, name] = useWatch({ control: form.control, name: ["imageUrl", "name"] });

  return (
    // Form dài (SEO, ảnh) — thân cuộn để header và nút Lưu luôn trong màn hình thấp
    <DialogScrollArea>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <Field label={`${F.code} *`} id="category-code" error={errors.code?.message}>
          <Input
            id="category-code"
            {...form.register("code")}
            disabled={editing}
            autoFocus={!editing}
            className={`${TAXONOMY_INPUT_CLASS} ${MONO}`}
          />
        </Field>
        <Field label={F.parent} id="category-parent" error={errors.parentId?.message}>
          {category ? (
            // Cha bất biến (`parent_id` updatable=false) — chỉ hiện mã đọc từ path
            <Input
              id="category-parent"
              value={parentCodeOf(category) ?? L.rootCategory}
              disabled
              readOnly
              className={`${TAXONOMY_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
            />
          ) : (
            <CategoryParentSelect form={form} />
          )}
        </Field>
      </div>
      <Field label={`${F.name} *`} id="category-name" error={errors.name?.message}>
        <Input
          id="category-name"
          {...form.register("name")}
          autoFocus={editing && !readOnly}
          className={TAXONOMY_INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-3">
        <Field label={F.sortOrder} id="category-sort" error={errors.sortOrder?.message}>
          <Input
            id="category-sort"
            inputMode="numeric"
            placeholder="0"
            {...form.register("sortOrder")}
            className={`${TAXONOMY_INPUT_CLASS} tabular-nums`}
          />
        </Field>
        <Field label={F.imageUrl} id="category-image" error={errors.imageUrl?.message}>
          <div className="flex items-center gap-2">
            <UrlPreviewThumb url={imageUrl} name={name} />
            <Input
              id="category-image"
              {...form.register("imageUrl")}
              placeholder="https://…"
              className={TAXONOMY_INPUT_CLASS}
            />
          </div>
        </Field>
      </div>
      <Field label={F.seoTitle} id="category-seo-title" error={errors.seoTitle?.message}>
        <Input
          id="category-seo-title"
          {...form.register("seoTitle")}
          className={TAXONOMY_INPUT_CLASS}
        />
      </Field>
      <Field label={F.seoDescription} id="category-seo-description">
        <Textarea
          id="category-seo-description"
          rows={3}
          {...form.register("seoDescription")}
          className={TAXONOMY_TEXTAREA_CLASS}
        />
      </Field>
      {editing && (
        <div className="space-y-1">
          <CheckboxField control={form.control} name="active" label={L.active} />
          <p className="text-ink-tertiary text-xs">{L.activeHint}</p>
        </div>
      )}
    </DialogScrollArea>
  );
}
