import { ADMIN_ROUTES } from "@/constants";
import { NOTIFICATION_CONFIG } from "@/constants/notifications";

// Printable ASCII without space. Anything else — tab/CR/LF (stripped by the URL parser, so
// "/\t/evil" would become "//evil"), DEL, Unicode look-alikes — is refused, not cleaned.
const PATH_CHARS = /^[\x21-\x7E]+$/;
// Encoded separators and dots decode back into `/`, `\` or `..` in later routing layers.
const ENCODED_SEPARATOR = /%(2f|5c|2e)/i;
// Throwaway origin: only used to let the URL parser canonicalize, never navigated to.
const PROBE_ORIGIN = "https://notification.invalid";
/**
 * Back-office sections whose links the BE writes as its `@PermissionResource` routes, relative to
 * `/admin` (e.g. invoicing's `/invoicing/einvoices/{id}`, production's `/production/...`; WF-05 BO-11).
 * Only these get `/admin` put in front; any other path outside `/admin` is still refused.
 */
const ADMIN_RELATIVE_SECTIONS = ["invoicing", "payment", "production"] as const;

/**
 * Canonical in-app target of a notification `link`, or null when it is not a plain root-relative
 * back-office path. BE (V20261014000400 ck_user_notification_link) only promises `/%` and not
 * `//%`; this is the stricter client policy (SCRUM-147): the canonical path must stay on
 * `/admin`, so no absolute, protocol-relative, backslash or dot-segment trick reaches the router.
 */
export function toSafeNotificationPath(raw: string): string | null {
  if (raw.length > NOTIFICATION_CONFIG.maxLinkLength || !PATH_CHARS.test(raw)) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN || ENCODED_SEPARATOR.test(url.pathname)) return null;
  const admin = ADMIN_ROUTES.home;
  const section = url.pathname.split("/")[1] ?? "";
  const path = (ADMIN_RELATIVE_SECTIONS as readonly string[]).includes(section)
    ? `${admin}${url.pathname}`
    : url.pathname;
  if (path !== admin && !path.startsWith(`${admin}/`)) return null;
  return `${path}${url.search}${url.hash}`;
}
