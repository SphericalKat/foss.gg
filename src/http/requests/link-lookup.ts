import { APEX_HOST } from "../../config/site";
import type { LinkKind } from "../../domain/link";
import {
  isSubdomainLabel,
  splitSubdomainKey,
} from "../../domain/subdomain-key";

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/u, "");

export const getRequestHostname = (request: Request): string =>
  normalizeHostname(new URL(request.url).hostname);

export const isApexRequest = (request: Request): boolean =>
  getRequestHostname(request) === APEX_HOST;

export const getLookup = (
  hostname: string,
  pathname: string
): { kind: LinkKind; key: string; fallbackKey: string | null } | null => {
  if (hostname === APEX_HOST) {
    return { fallbackKey: null, key: pathname, kind: "path" };
  }
  if (!hostname.endsWith(`.${APEX_HOST}`)) {
    return null;
  }

  const label = hostname.slice(0, -APEX_HOST.length - 1);
  if (!label || label.includes(".") || !isSubdomainLabel(label)) {
    return null;
  }
  const trimmedPathname = pathname.replace(/\/+$/u, "");
  const { path } = splitSubdomainKey(`${label}${trimmedPathname}`);
  return path
    ? { fallbackKey: label, key: `${label}${path}`, kind: "subdomain" }
    : { fallbackKey: null, key: label, kind: "subdomain" };
};
