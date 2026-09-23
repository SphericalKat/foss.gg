import type { Context } from "hono";

import type { AppBindings } from "../bindings";
import { findLink } from "../models/links";
import { APEX_HOST, getRequestHostname } from "../request-host";
import { isSubdomainLabel, splitSubdomainKey } from "../subdomain-key";
import type { LinkKind } from "../types";

const getLookup = (
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

export const handleRedirect = async (
  context: Context<AppBindings>
): Promise<Response> => {
  const url = new URL(context.req.url);
  const lookup = getLookup(getRequestHostname(context.req.raw), url.pathname);
  if (!lookup) {
    return context.text("Not found", 404);
  }

  try {
    const link =
      (await findLink(context.env.DB, lookup.kind, lookup.key)) ??
      (lookup.fallbackKey
        ? await findLink(context.env.DB, lookup.kind, lookup.fallbackKey)
        : null);

    return link
      ? new Response(null, {
          headers: { Location: link.destination },
          status: 302,
        })
      : context.text("Not found", 404);
  } catch {
    return context.text("Internal server error", 500);
  }
};
