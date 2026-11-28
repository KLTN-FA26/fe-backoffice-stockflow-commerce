"use client";

import { useMemo } from "react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { ATTRIBUTE_DATA_TYPES } from "../attribute-schemas";
import { ATTRIBUTE_ACTIVE_FILTERS } from "./AttributeFilterPopover";

/**
 * Bộ lọc danh sách thuộc tính trên URL (F5 giữ nguyên). BE lọc theo `q`, `dataType`, `active` (mỗi
 * tham số một giá trị). Ô lọc cột Mã / Tên có khoá URL riêng (`attrCode` / `attrName`), tách khỏi ô
 * tìm chính `q`: BE chỉ có một `q` (mã HOẶC tên) nên gửi chữ đó để thu hẹp rồi lọc đúng cột ở FE.
 */
export function useAttributeListState() {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [dataType, setDataType] = useQueryState(
    "dataType",
    parseAsStringLiteral(ATTRIBUTE_DATA_TYPES),
  );
  const [active, setActive] = useQueryState(
    "active",
    parseAsStringLiteral(ATTRIBUTE_ACTIVE_FILTERS),
  );
  const [code, setCode] = useQueryState("attrCode", parseAsString.withDefault(""));
  const [name, setName] = useQueryState("attrName", parseAsString.withDefault(""));
  const debouncedQ = useDebouncedValue(q, 300).trim();
  const debouncedCode = useDebouncedValue(code, 300).trim();
  const debouncedName = useDebouncedValue(name, 300).trim();

  const params = useMemo(
    () => ({
      q: debouncedQ || debouncedCode || debouncedName || undefined,
      dataType: dataType ?? undefined,
      active: active === null ? undefined : active === "true",
    }),
    [debouncedQ, debouncedCode, debouncedName, dataType, active],
  );

  const resetAll = () => {
    void setQ(null);
    void setDataType(null);
    void setActive(null);
    void setCode(null);
    void setName(null);
  };

  return {
    q,
    setQ,
    dataType,
    setDataType,
    active,
    setActive,
    code,
    setCode,
    name,
    setName,
    params,
    columnSearch: { code: debouncedCode, name: debouncedName },
    filtered: Boolean(debouncedQ || debouncedCode || debouncedName || dataType || active),
    resetAll,
  };
}

export type AttributeListState = ReturnType<typeof useAttributeListState>;
