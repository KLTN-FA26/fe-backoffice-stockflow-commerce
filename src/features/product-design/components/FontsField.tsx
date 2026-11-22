"use client";

import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { Button } from "@/components/ui/button";

import { useDesignFonts } from "../queries";
import { Choices, OPTION_CLASS } from "./FileRulesChoices";

import type { Control } from "react-hook-form";
import type { PrintDefaultsValues } from "./print-defaults";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.fileRules;

/**
 * The font choices: the BE's list (`GET /design-fonts`, BE-18), plus any stored code the list does not have, shown as
 * "(mã lạ)" so it is seen and can be unticked rather than silently dropped.
 */
function fontChoices(fonts: readonly { code: string; label: string }[], stored: readonly string[]) {
  const known = new Set(fonts.map(({ code }) => code));
  return [
    ...fonts.map(({ code, label }) => ({ value: code, label })),
    ...stored
      .filter((code) => !known.has(code))
      .map((code) => ({ value: code, label: TEXT.fontUnknown(code) })),
  ];
}

/**
 * "Font được dùng": every font (`null`), or only the ticked ones (never an empty list: the BE rejects it). "Only" starts
 * with the list's first font, so it stays unavailable until the list has loaded.
 */
export function Fonts({
  control,
  disabled,
  error,
}: {
  control: Control<PrintDefaultsValues>;
  disabled: boolean;
  error?: string;
}) {
  const fonts = useWatch({ control, name: "allowedFontCodes" });
  const list = useDesignFonts();
  const limited = fonts !== null;
  const name = useId();
  const firstFont = list.data?.[0]?.code;
  return (
    <div className="flex flex-col gap-2 @sm:col-span-2 @3xl:col-span-3">
      <Controller
        control={control}
        name="allowedFontCodes"
        render={({ field }) => (
          <fieldset disabled={disabled} className="flex flex-col gap-1">
            <legend className="text-ink-secondary mb-1.5 text-xs font-medium">
              {TEXT.fields.allowedFontCodes}
            </legend>
            {[false, true].map((only) => (
              <label key={String(only)} className={OPTION_CLASS}>
                <input
                  type="radio"
                  name={name}
                  className="accent-accent size-4"
                  checked={limited === only}
                  disabled={only && !limited && !firstFont}
                  onChange={() => field.onChange(only ? (firstFont ? [firstFont] : []) : null)}
                />
                {only ? TEXT.fontsOnly : TEXT.fontsAll}
              </label>
            ))}
          </fieldset>
        )}
      />
      {limited && list.data && (
        <Choices
          name="allowedFontCodes"
          legend={TEXT.fontsGroup}
          control={control}
          choices={fontChoices(list.data, fonts)}
          disabled={disabled}
          error={error}
        />
      )}
      {list.isPending && (
        <p role="status" className="text-ink-secondary text-xs">
          {TEXT.fontsLoading}
        </p>
      )}
      {list.isError && (
        <div role="alert" className="text-danger flex items-center gap-2 text-xs">
          {TEXT.fontsError}
          <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>
            {TEXT.fontsRetry}
          </Button>
        </div>
      )}
      {limited && !list.data && error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
