import { APEX_HOST } from "../config/site";
import type { LinkKind } from "../domain/link";
import { splitSubdomainKey } from "../domain/subdomain-key";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_BEFORE_DATE = 30;

export const shortUrl = (kind: LinkKind, key: string): string => {
  if (kind === "path") {
    return `${APEX_HOST}${key}`;
  }
  const { label, path } = splitSubdomainKey(key);
  return `${label}.${APEX_HOST}${path ?? ""}`;
};

export const withoutScheme = (url: string): string =>
  url.replace(/^https?:\/\//u, "");

export const timeAgo = (iso: string, now: number): string => {
  const minutes = Math.round((now - Date.parse(iso)) / MINUTE_MS);
  if (Number.isNaN(minutes)) {
    return iso;
  }
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / HOURS_PER_DAY);
  return days < DAYS_BEFORE_DATE ? `${days}d ago` : iso.slice(0, 10);
};
