"use client";

import { useId, useState } from "react";

import { CHAT_MENTION_DEBOUNCE_MS } from "@/constants";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { KeyboardEvent, RefObject } from "react";
import type { ChatStaff } from "../schemas";

/** "@" opening a word, then the letters typed so far (no spaces): the mention being written at the caret. */
const MENTION_TOKEN = /(^|\s)@([^\s@]*)$/;

interface Token {
  /** Index of the "@" in the text. */
  at: number;
  query: string;
}

/** "@" opening a word followed by a letter or digit: text that reads like a mention (BO-UX-43 warning). */
const MENTION_LIKE = /(^|\s)@[\p{L}\p{N}]/u;

/** Whether `text` holds what reads like an @mention — in a reply to the customer, likely meant as a note. */
export function looksLikeMention(text: string): boolean {
  return MENTION_LIKE.test(text);
}

function tokenAt(value: string, caret: number): Token | null {
  const found = MENTION_TOKEN.exec(value.slice(0, caret));
  return found ? { at: caret - found[2].length - 1, query: found[2] } : null;
}

/**
 * The "@mention" state of the note composer (BE-11): the token under the caret, the picker's rows and highlighted row,
 * keyboard handling (↑/↓/Enter/Esc while the picker is open) and the people picked so far. Focus stays in the textarea.
 */
export function useMentionComposer({
  enabled,
  text,
  setText,
  area,
}: {
  /** Only internal notes take mentions. */
  enabled: boolean;
  text: string;
  setText: (text: string) => void;
  area: RefObject<HTMLTextAreaElement | null>;
}) {
  const [token, setToken] = useState<Token | null>(null);
  const [mentioned, setMentioned] = useState<Pick<ChatStaff, "id" | "name">[]>([]);
  const [items, setItems] = useState<ChatStaff[]>([]);
  const [activeId, setActiveId] = useState("");
  const [activeDomId, setActiveDomId] = useState<string>();
  const picking = enabled && token !== null;
  // Reset while closed, so reopening never fetches the previous term.
  const query = useDebouncedValue(picking ? token.query : "", CHAT_MENTION_DEBOUNCE_MS);
  const listId = `${useId()}-mentions`;
  const active = items.find((p) => p.id === activeId) ?? items[0];
  const syncToken = (el: HTMLTextAreaElement) => setToken(tokenAt(el.value, el.selectionStart));

  const pick = (person: ChatStaff) => {
    if (!token) return;
    const caret = token.at + 1 + token.query.length;
    const inserted = `@${person.name} `;
    setText(text.slice(0, token.at) + inserted + text.slice(caret));
    setMentioned((list) =>
      list.some((p) => p.id === person.id) ? list : [...list, { id: person.id, name: person.name }],
    );
    setToken(null);
    const next = token.at + inserted.length;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(next, next);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!picking) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setToken(null);
      return;
    }
    if (items.length === 0) return;
    const index = Math.max(items.indexOf(active), 0);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveId(items[(index + step + items.length) % items.length].id);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      pick(items[index]);
    }
  };

  return {
    picking,
    /** Props for the textarea: caret tracking, keys, and the combobox role while the picker is open. */
    textareaProps: {
      onKeyDown,
      // Caret moved or focus left: the "@word" under the caret may be gone.
      onKeyUp: (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Escape closed the picker on keydown: do not reopen it.
        if (event.key !== "Escape") syncToken(event.currentTarget);
      },
      onClick: (event: { currentTarget: HTMLTextAreaElement }) => syncToken(event.currentTarget),
      onBlur: () => setToken(null),
      ...(picking
        ? {
            role: "combobox",
            "aria-expanded": true,
            "aria-controls": listId,
            "aria-autocomplete": "list" as const,
            "aria-activedescendant": activeDomId,
          }
        : {}),
    },
    /** Call from the textarea's onChange with the new value and caret. */
    track: (value: string, caret: number) => setToken(tokenAt(value, caret)),
    pickerProps: {
      query,
      listId,
      activeId: active?.id ?? "",
      onActiveChange: setActiveId,
      onPick: pick,
      onItems: setItems,
      onActiveDomId: setActiveDomId,
    },
    /** Ids of the people whose "@name" is still in the note. */
    mentionIds: (note: string) =>
      mentioned.filter((p) => note.includes(`@${p.name}`)).map((p) => p.id),
    reset: () => {
      setToken(null);
      setMentioned([]);
    },
  };
}
